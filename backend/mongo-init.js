// MongoDB initialization script
db = db.getSiblingDB("workout-lockout");

// Create application user with limited permissions
db.createUser({
  user: "workout-app",
  pwd: process.env.MONGO_APP_PASSWORD || "change-this-password",
  roles: [
    {
      role: "readWrite",
      db: "workout-lockout",
    },
  ],
});

// Create indexes for performance and security
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ deviceId: 1 }, { unique: true });
db.users.createIndex({ lastActive: 1 });
db.users.createIndex({ createdAt: 1 });

db.workouts.createIndex({ userId: 1, startTime: -1 });
db.workouts.createIndex(
  { userId: 1, source: 1, startTime: 1, duration: 1 },
  { unique: true }
);
db.workouts.createIndex({ createdAt: 1 }); // For data cleanup

db.credittransactions.createIndex({ userId: 1, timestamp: -1 });
db.credittransactions.createIndex({ expiresAt: 1 });
db.credittransactions.createIndex({ createdAt: 1 }); // For data cleanup

db.fitnessintegrations.createIndex(
  { userId: 1, provider: 1 },
  { unique: true }
);
db.fitnessintegrations.createIndex({ createdAt: 1 }); // For data cleanup

print("Database initialized successfully");
