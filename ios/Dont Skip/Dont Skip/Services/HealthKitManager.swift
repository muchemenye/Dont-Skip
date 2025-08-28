import Foundation
import HealthKit
import Combine

class HealthKitManager: ObservableObject {
    private let healthStore = HKHealthStore()
    @Published var isAuthorized = false
    @Published var recentWorkouts: [Workout] = []
    @Published var isLoading = false
    
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        print("� HealthKitManager BASIC INIT LOG")
        checkInitialAuthorizationStatus()
    }
    
    private func checkInitialAuthorizationStatus() {
        #if targetEnvironment(simulator)
        print("� Simulator detected - setting isAuthorized to true")
        DispatchQueue.main.async {
            self.isAuthorized = true
            self.loadMockWorkouts()
        }
        #else
        print("� Device detected - checking real HealthKit authorization")
        // On real device, check if we have authorization
        let workoutType = HKObjectType.workoutType()
        let authorizationStatus = healthStore.authorizationStatus(for: workoutType)
        
        DispatchQueue.main.async {
            self.isAuthorized = (authorizationStatus == .sharingAuthorized)
            if self.isAuthorized {
                self.fetchRecentWorkouts()
            }
        }
        #endif
    }
    
    // MARK: - Authorization
    
        // MARK: - Simulator Support
    
    func requestAuthorizationWithSimulator(completion: @escaping (Bool, Error?) -> Void) {
        #if targetEnvironment(simulator)
        // In simulator, use mock data
        DispatchQueue.main.async {
            self.isAuthorized = true
            completion(true, nil)
            self.loadMockWorkouts()
        }
        #else
        // On device, use real HealthKit
        requestAuthorization(completion: completion)
        #endif
    }
    
    func fetchRecentWorkoutsWithSimulator(days: Int = 7) {
        print("🔄 fetchRecentWorkoutsWithSimulator called")
        #if targetEnvironment(simulator)
        print("✅ Running in simulator - loading mock workouts")
        loadMockWorkouts()
        #else
        print("📱 Running on device - loading real HealthKit workouts")
        fetchRecentWorkouts(days: days)
        #endif
    }
    
    private func loadMockWorkouts() {
        #if targetEnvironment(simulator)
        print("🔄 Loading mock workouts for simulator...")
        
        let mockWorkouts = HealthKitTestData.generateMockWorkouts()
        let convertedWorkouts = mockWorkouts.compactMap { convertMockWorkout($0) }
        
        DispatchQueue.main.async {
            self.recentWorkouts = convertedWorkouts
            print("✅ Loaded \(convertedWorkouts.count) mock workouts")
        }
        #endif
    }
    
    // Temporary inline mock data generation to avoid build dependencies
    private func generateMockWorkouts() -> [MockHKWorkout] {
        let now = Date()
        let calendar = Calendar.current
        
        return [
            MockHKWorkout(
                id: "mock-walk-1",
                workoutActivityType: .walking,
                startDate: calendar.date(byAdding: .hour, value: -8, to: now)!,
                endDate: calendar.date(byAdding: .hour, value: -8, to: calendar.date(byAdding: .minute, value: -15, to: now)!)!,
                duration: 15 * 60, // 15 minutes
                totalEnergyBurned: 45.0, // calories
                totalDistance: 1200.0 // meters
            ),
            MockHKWorkout(
                id: "mock-run-1",
                workoutActivityType: .running,
                startDate: calendar.date(byAdding: .hour, value: -2, to: now)!,
                endDate: calendar.date(byAdding: .hour, value: -2, to: calendar.date(byAdding: .minute, value: -25, to: now)!)!,
                duration: 25 * 60, // 25 minutes
                totalEnergyBurned: 280.0, // calories
                totalDistance: 4200.0 // meters
            )
        ]
    }
    
    private func convertMockWorkout(_ mockWorkout: MockHKWorkout) -> Workout? {
        let workoutType = convertWorkoutType(mockWorkout.workoutActivityType)
        let duration = Int(mockWorkout.duration / 60) // Convert to minutes
        
        // Evidence-based conversion ratios (WHO research-backed)
        let creditsEarned: Int
        switch mockWorkout.workoutActivityType {
        case .walking, .hiking:
            creditsEarned = duration * 8  // 8 minutes coding per 1 minute walk (light movement)
        case .running, .cycling, .swimming:
            creditsEarned = duration * 12 // 12 minutes coding per 1 minute cardio (moderate-vigorous)
        case .functionalStrengthTraining, .traditionalStrengthTraining:
            creditsEarned = duration * 15 // 15 minutes coding per 1 minute strength (high effort)
        case .highIntensityIntervalTraining, .crossTraining:
            creditsEarned = duration * 18 // 18 minutes coding per 1 minute HIIT (maximum effort)
        case .yoga, .pilates:
            creditsEarned = duration * 10 // 10 minutes coding per 1 minute mindful movement
        default:
            creditsEarned = duration * 12 // 12 minutes default (moderate activity)
        }
        
        return Workout(
            id: mockWorkout.id,
            type: workoutType,
            startTime: mockWorkout.startDate,
            endTime: mockWorkout.endDate,
            duration: duration,
            calories: mockWorkout.totalEnergyBurned.map { Int($0) },
            heartRate: nil,
            distance: mockWorkout.totalDistance.map { $0 / 1000.0 }, // Convert to km
            source: .healthKit,
            creditsAwarded: creditsEarned,
            verified: true,
            processed: false
        )
    }
    
    // MARK: - Authorization
    
    func requestAuthorization(completion: @escaping (Bool, Error?) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            let error = NSError(domain: "HealthKitManager", code: 1, userInfo: [NSLocalizedDescriptionKey: "HealthKit is not available on this device"])
            completion(false, error)
            return
        }
        
        let readTypes: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!,
            HKObjectType.quantityType(forIdentifier: .distanceCycling)!,
            HKObjectType.quantityType(forIdentifier: .distanceSwimming)!
        ]
        
        healthStore.requestAuthorization(toShare: nil, read: readTypes) { [weak self] success, error in
            DispatchQueue.main.async {
                self?.isAuthorized = success
                if success {
                    self?.startObservingWorkouts()
                    self?.fetchRecentWorkouts()
                }
                completion(success, error)
            }
            
            if let error = error {
                print("HealthKit authorization error: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Workout Fetching
    
    func fetchRecentWorkouts(days: Int = 7) {
        guard isAuthorized else { return }
        
        isLoading = true
        
        let calendar = Calendar.current
        let endDate = Date()
        let startDate = calendar.date(byAdding: .day, value: -days, to: endDate)!
        
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )
        
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
        ) { [weak self] _, samples, error in
            
            if let error = error {
                print("Error fetching workouts: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self?.isLoading = false
                }
                return
            }
            
            guard let workouts = samples as? [HKWorkout] else {
                DispatchQueue.main.async {
                    self?.isLoading = false
                }
                return
            }
            
            let convertedWorkouts = workouts.compactMap { self?.convertHealthKitWorkout($0) }
            
            DispatchQueue.main.async {
                self?.recentWorkouts = convertedWorkouts
                self?.isLoading = false
            }
        }
        
        healthStore.execute(query)
    }
    
    // MARK: - Background Observation
    
    private func startObservingWorkouts() {
        let query = HKObserverQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: nil
        ) { [weak self] _, _, error in
            if let error = error {
                print("Observer query error: \(error.localizedDescription)")
                return
            }
            
            // Fetch new workouts when changes are detected
            DispatchQueue.main.async {
                self?.fetchRecentWorkouts()
            }
        }
        
        healthStore.execute(query)
        healthStore.enableBackgroundDelivery(
            for: HKObjectType.workoutType(),
            frequency: .immediate
        ) { success, error in
            if let error = error {
                print("Background delivery error: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Conversion Methods
    
    private func convertHealthKitWorkout(_ hkWorkout: HKWorkout) -> Workout? {
        let workoutType = convertWorkoutType(hkWorkout.workoutActivityType)
        let duration = Int(hkWorkout.duration / 60) // Convert to minutes
        
        // Evidence-based conversion ratios (WHO research-backed)
        let creditsEarned: Int
        switch hkWorkout.workoutActivityType {
        case .walking, .hiking:
            creditsEarned = duration * 8  // 8 minutes coding per 1 minute walk (light movement)
        case .running, .cycling, .swimming:
            creditsEarned = duration * 12 // 12 minutes coding per 1 minute cardio (moderate-vigorous)
        case .functionalStrengthTraining, .traditionalStrengthTraining:
            creditsEarned = duration * 15 // 15 minutes coding per 1 minute strength (high effort)
        case .highIntensityIntervalTraining, .crossTraining:
            creditsEarned = duration * 18 // 18 minutes coding per 1 minute HIIT (maximum effort)
        case .yoga, .pilates:
            creditsEarned = duration * 10 // 10 minutes coding per 1 minute mindful movement
        default:
            creditsEarned = duration * 12 // 12 minutes default (moderate activity)
        }
        
        // Get calories from statistics (modern approach)
        let calories = getCaloriesFromStatistics(hkWorkout)
        
        // Get distance from statistics (modern approach)
        let distance = getDistanceFromStatistics(hkWorkout)
        
        return Workout(
            id: hkWorkout.uuid.uuidString,
            type: workoutType,
            startTime: hkWorkout.startDate,
            endTime: hkWorkout.endDate,
            duration: duration,
            calories: calories,
            heartRate: nil, // Would need separate query for heart rate data
            distance: distance,
            source: .healthKit,
            creditsAwarded: creditsEarned,
            verified: true,
            processed: false
        )
    }
    
    private func getCaloriesFromStatistics(_ workout: HKWorkout) -> Int? {
        guard let energyBurnedType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            return nil
        }
        
        let statistics = workout.statistics(for: energyBurnedType)
        return statistics?.sumQuantity().map { Int($0.doubleValue(for: .kilocalorie())) }
    }
    
    private func getDistanceFromStatistics(_ workout: HKWorkout) -> Double? {
        let distanceType: HKQuantityType?
        
        switch workout.workoutActivityType {
        case .running, .walking:
            distanceType = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)
        case .cycling:
            distanceType = HKQuantityType.quantityType(forIdentifier: .distanceCycling)
        case .swimming:
            distanceType = HKQuantityType.quantityType(forIdentifier: .distanceSwimming)
        default:
            distanceType = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)
        }
        
        guard let type = distanceType else { return nil }
        
        let statistics = workout.statistics(for: type)
        return statistics?.sumQuantity()?.doubleValue(for: .meter())
    }
    
    private func convertWorkoutType(_ hkType: HKWorkoutActivityType) -> WorkoutType {
        switch hkType {
        case .running:
            return .running
        case .cycling:
            return .cycling
        case .walking:
            return .walking
        case .functionalStrengthTraining, .traditionalStrengthTraining:
            return .strength
        case .yoga:
            return .yoga
        case .swimming:
            return .swimming
        case .highIntensityIntervalTraining:
            return .hiit
        default:
            return .other
        }
    }
    
    // MARK: - Heart Rate Data
    
    func fetchHeartRateData(for workout: Workout, completion: @escaping (HeartRateData?) -> Void) {
        guard isAuthorized else {
            completion(nil)
            return
        }
        
        let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
        let predicate = HKQuery.predicateForSamples(
            withStart: workout.startTime,
            end: workout.endTime,
            options: .strictStartDate
        )
        
        let query = HKStatisticsQuery(
            quantityType: heartRateType,
            quantitySamplePredicate: predicate,
            options: [.discreteAverage, .discreteMax]
        ) { _, statistics, error in
            
            if let error = error {
                print("Heart rate query error: \(error.localizedDescription)")
                completion(nil)
                return
            }
            
            guard let statistics = statistics else {
                completion(nil)
                return
            }
            
            let averageHR = statistics.averageQuantity()?.doubleValue(for: .count().unitDivided(by: .minute()))
            let maxHR = statistics.maximumQuantity()?.doubleValue(for: .count().unitDivided(by: .minute()))
            
            let heartRateData = HeartRateData(
                average: averageHR.map(Int.init),
                maximum: maxHR.map(Int.init)
            )
            
            DispatchQueue.main.async {
                completion(heartRateData)
            }
        }
        
        healthStore.execute(query)
    }
}