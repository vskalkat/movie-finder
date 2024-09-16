import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

app.use(cors());

const PORT = 5000;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Additional Socket.IO functionality as previously provided

interface SessionData {
  users: string[];
  swipes: {
    [userId: string]: {
      [movieId: string]: "left" | "right";
    };
  };
}

const sessions: {
  [sessionId: string]: SessionData;
} = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle session creation
  socket.on("createSession", (callback) => {
    const sessionId = generateSessionId();
    sessions[sessionId] = {
      users: [socket.id],
      swipes: {},
    };
    socket.join(sessionId);
    callback(sessionId);
    console.log(`Session created: ${sessionId}`);
  });

  // Handle joining a session
  socket.on("joinSession", (sessionId: string, callback) => {
    const session = sessions[sessionId];
    if (session && session.users.length < 2) {
      session.users.push(socket.id);
      socket.join(sessionId);
      callback({ success: true });
      io.to(sessionId).emit("startSwiping");
      console.log(`User ${socket.id} joined session ${sessionId}`);
    } else {
      callback({
        success: false,
        message: "Session is full or does not exist",
      });
    }
  });

  // Handle swiping
  socket.on("swipe", ({ sessionId, movieId, direction }) => {
    const session = sessions[sessionId];
    if (session) {
      if (!session.swipes[socket.id]) {
        session.swipes[socket.id] = {};
      }
      session.swipes[socket.id][movieId] = direction;
      checkForMatch(sessionId, movieId);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    // Clean up sessions
    for (const sessionId in sessions) {
      const session = sessions[sessionId];
      session.users = session.users.filter((id) => id !== socket.id);
      if (session.users.length === 0) {
        delete sessions[sessionId];
      }
    }
  });
});

function generateSessionId() {
  return Math.random().toString(36).substr(2, 9);
}

function checkForMatch(sessionId: string, movieId: string) {
  const session = sessions[sessionId];
  const userIds = session.users;
  if (userIds.length === 2) {
    const [user1Id, user2Id] = userIds;
    const user1Swipe = session.swipes[user1Id]?.[movieId];
    const user2Swipe = session.swipes[user2Id]?.[movieId];

    if (user1Swipe === "right" && user2Swipe === "right") {
      // It's a match!
      io.to(sessionId).emit("match", { movieId });
      console.log(`Match found in session ${sessionId} for movie ${movieId}`);
    }
  }
}
