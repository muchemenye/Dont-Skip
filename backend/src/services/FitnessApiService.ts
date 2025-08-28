import axios, { AxiosResponse } from "axios";
import { FitnessIntegration } from "../models/FitnessIntegration";
import { Workout } from "../models/Workout";
import { WorkoutData } from "../types";
import { EncryptionService } from "../utils/encryption";
import logger from "../utils/simpleLogger";

export class FitnessApiService {
  async syncUserWorkouts(
    userId: string,
    hours: number = 24
  ): Promise<WorkoutData[]> {
    const integrations = await FitnessIntegration.find({
      userId,
      isActive: true,
    });

    const allWorkouts: WorkoutData[] = [];

    for (const integration of integrations) {
      try {
        const workouts = await this.syncIntegration(integration, hours);
        allWorkouts.push(...workouts);
      } catch (error) {
        logger.error(
          `Error syncing ${integration.provider} for user ${userId}:`,
          error
        );
      }
    }

    // Save new workouts to database
    const savedWorkouts = await this.saveWorkouts(allWorkouts);

    // Update last sync time
    await FitnessIntegration.updateMany(
      { userId, isActive: true },
      { lastSync: new Date() }
    );

    return savedWorkouts;
  }

  private async syncIntegration(
    integration: FitnessIntegration,
    hours: number
  ): Promise<WorkoutData[]> {
    const accessToken = EncryptionService.decrypt(integration.accessToken);

    switch (integration.provider) {
      case "whoop":
        return this.syncWhoop(integration.userId, accessToken, hours);
      case "strava":
        return this.syncStrava(integration.userId, accessToken, hours);
      case "fitbit":
        return this.syncFitbit(integration.userId, accessToken, hours);
      default:
        throw new Error(`Unsupported provider: ${integration.provider}`);
    }
  }

  private async syncWhoop(
    userId: string,
    accessToken: string,
    hours: number
  ): Promise<WorkoutData[]> {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

    try {
      const response = await axios.get(
        `https://api.prod.whoop.com/developer/v1/activity/workout`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
          timeout: 10000,
        }
      );

      return (
        response.data.records?.map((workout: any) => ({
          id: `whoop_${workout.id}`,
          userId,
          source: "whoop" as const,
          type: this.mapWhoopSportId(workout.sport_id) || "workout",
          startTime: new Date(workout.start),
          endTime: new Date(workout.end),
          duration: Math.round(
            (new Date(workout.end).getTime() -
              new Date(workout.start).getTime()) /
              (1000 * 60)
          ),
          calories: workout.score?.kilojoule
            ? Math.round(workout.score.kilojoule * 0.239006)
            : undefined,
          heartRate: workout.score?.average_heart_rate
            ? {
                average: Math.round(workout.score.average_heart_rate),
                max: Math.round(workout.score.max_heart_rate || 0),
              }
            : undefined,
          verified: true,
          processed: false,
        })) || []
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await this.deactivateIntegration(userId, "whoop");
        throw new Error("Whoop token expired");
      }
      throw error;
    }
  }

  private async syncStrava(
    userId: string,
    accessToken: string,
    hours: number
  ): Promise<WorkoutData[]> {
    const after = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);

    try {
      const response = await axios.get(
        "https://www.strava.com/api/v3/athlete/activities",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            after,
            per_page: 50,
          },
          timeout: 10000,
        }
      );

      return response.data.map((activity: any) => ({
        id: `strava_${activity.id}`,
        userId,
        source: "strava" as const,
        type: this.mapStravaActivityType(activity.type),
        startTime: new Date(activity.start_date),
        endTime: new Date(
          new Date(activity.start_date).getTime() + activity.elapsed_time * 1000
        ),
        duration: Math.round(activity.moving_time / 60),
        calories: activity.calories || undefined,
        heartRate: activity.average_heartrate
          ? {
              average: Math.round(activity.average_heartrate),
              max: Math.round(activity.max_heartrate || 0),
            }
          : undefined,
        distance: activity.distance || undefined,
        verified: true,
        processed: false,
      }));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await this.deactivateIntegration(userId, "strava");
        throw new Error("Strava token expired");
      }
      throw error;
    }
  }

  private async syncFitbit(
    userId: string,
    accessToken: string,
    hours: number
  ): Promise<WorkoutData[]> {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    const activities: WorkoutData[] = [];

    try {
      // Fitbit requires date-by-date requests
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split("T")[0];

        const response = await axios.get(
          `https://api.fitbit.com/1/user/-/activities/date/${dateStr}.json`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
          }
        );

        if (response.data.activities) {
          for (const activity of response.data.activities) {
            const activityStart = new Date(
              `${activity.startDate}T${activity.startTime}`
            );
            if (activityStart >= start && activityStart <= end) {
              activities.push({
                id: `fitbit_${activity.logId}`,
                userId,
                source: "fitbit" as const,
                type: this.mapFitbitActivityType(activity.activityName),
                startTime: activityStart,
                endTime: new Date(
                  activityStart.getTime() + (activity.duration || 0)
                ),
                duration: Math.round((activity.duration || 0) / (1000 * 60)),
                calories: activity.calories || undefined,
                heartRate: activity.averageHeartRate
                  ? {
                      average: Math.round(activity.averageHeartRate),
                      max: Math.round(activity.maxHeartRate || 0),
                    }
                  : undefined,
                distance: activity.distance
                  ? Math.round(activity.distance * 1609.34)
                  : undefined,
                verified: true,
                processed: false,
              });
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return activities;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await this.deactivateIntegration(userId, "fitbit");
        throw new Error("Fitbit token expired");
      }
      throw error;
    }
  }

  private async saveWorkouts(workouts: WorkoutData[]): Promise<WorkoutData[]> {
    const savedWorkouts: WorkoutData[] = [];

    for (const workoutData of workouts) {
      try {
        // Check if workout already exists (prevent duplicates)
        const existing = await Workout.findOne({
          userId: workoutData.userId,
          source: workoutData.source,
          startTime: workoutData.startTime,
          duration: workoutData.duration,
        });

        if (!existing) {
          const workout = new Workout(workoutData);
          await workout.save();
          savedWorkouts.push(workout.toJSON());
        }
      } catch (error) {
        logger.error("Error saving workout:", error);
      }
    }

    return savedWorkouts;
  }

  private async deactivateIntegration(
    userId: string,
    provider: string
  ): Promise<void> {
    await FitnessIntegration.updateOne(
      { userId, provider },
      { isActive: false }
    );
    logger.warn(
      `Deactivated ${provider} integration for user ${userId} due to auth error`
    );
  }

  // Mapping functions (same as before but extracted for reuse)
  private mapWhoopSportId(sportId: number): string {
    const sportMap: Record<number, string> = {
      0: "running",
      1: "cycling",
      16: "baseball",
      17: "basketball",
      18: "rowing",
      22: "golf",
      24: "ice_hockey",
      29: "skiing",
      30: "soccer",
      33: "swimming",
      34: "tennis",
      39: "boxing",
      43: "pilates",
      44: "yoga",
      45: "weightlifting",
      48: "functional_fitness",
      51: "hiking",
      55: "martial_arts",
      56: "meditation",
      63: "rock_climbing",
      69: "snowboarding",
      79: "walking",
      85: "strength_training",
      98: "jump_rope",
      101: "elliptical",
      103: "lap_swimming",
      104: "running",
    };
    return sportMap[sportId] || "workout";
  }

  private mapStravaActivityType(type: string): string {
    const typeMap: Record<string, string> = {
      Run: "running",
      Ride: "cycling",
      Swim: "swimming",
      Hike: "hiking",
      Walk: "walking",
      WeightTraining: "strength_training",
      Yoga: "yoga",
      Crossfit: "functional_fitness",
    };
    return typeMap[type] || type.toLowerCase();
  }

  private mapFitbitActivityType(activityName: string): string {
    const typeMap: Record<string, string> = {
      Running: "running",
      Walk: "walking",
      Bike: "cycling",
      Swimming: "swimming",
      Weights: "strength_training",
      Yoga: "yoga",
      Workout: "workout",
      Tennis: "tennis",
      Basketball: "basketball",
    };
    return (
      typeMap[activityName] || activityName.toLowerCase().replace(/\s+/g, "_")
    );
  }
}
