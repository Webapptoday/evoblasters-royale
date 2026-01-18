// Colyseus is loaded from CDN in index.html
const ENDPOINT = "wss://evoblasters-server-production.up.railway.app";

let connectingPromise = null;
let matchmakingPromise = null;

export const net = {
  client: null,
  matchmakingRoom: null, // ✅ Lobby room
  battleRoom: null, // ✅ Battle room
  room: null, // ✅ Reference to current active room
  sessionId: null,
  players: new Map(),
  onShotCallbacks: [],
  matchFoundCallback: null, // ✅ Callback when match found
  currentOpponent: null, // ✅ Store opponent name
  currentOpponentId: null, // ✅ Store opponent ID
  currentMatchId: null, // ✅ Store current match ID
  objective: null, // ✅ Objective state

  registerShotListener(callback) {
    this.onShotCallbacks.push(callback);
    console.log("[net.js] Registered shot listener, total:", this.onShotCallbacks.length);
  },

  objectiveDestroyedCallback: null,
  registerObjectiveDestroyedListener(callback) {
    this.objectiveDestroyedCallback = callback;
    console.log("[net.js] Registered objective destroyed listener");
  },

  async connect(playerName = "Player") {
    // ✅ prevent double connect
    if (this.battleRoom) {
      console.warn("Already in battle, reusing battle room");
      return this.battleRoom;
    }

    if (connectingPromise) {
      return connectingPromise;
    }

    connectingPromise = (async () => {
      try {
        console.log("[net.js] Connecting to Colyseus…");
        console.log("[net.js] Endpoint:", ENDPOINT);

        // ✅ create client ONCE
        if (!this.client) {
          console.log("[net.js] Creating new Colyseus client...");
          this.client = new Colyseus.Client(ENDPOINT);
        }

        // ✅ Add timeout to connection attempt (10 seconds)
        const connectionTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Connection timeout - server may be down")), 10000)
        );

        // Step 1: Join matchmaking lobby (ALL players join same room)
        console.log("[net.js] Joining matchmaking lobby...");
        const matchRoom = await Promise.race([
          this.client.joinOrCreate("matchmaking", { type: "matchmaking" }),
          connectionTimeout
        ]);
        this.matchmakingRoom = matchRoom;
        this.room = matchRoom; // ✅ Current active room
        this.sessionId = matchRoom.sessionId;

        console.log("[net.js] ✅ Joined matchmaking, sessionId:", this.sessionId);

      // ✅ Listen for match found event
      matchRoom.onMessage("match_found", async (msg) => {
        console.log("[net.js] ✅ MATCH FOUND!", msg);
        const { matchId, opponent, opponentId } = msg;
        
        // ✅ Store opponent info for later
        this.currentOpponent = opponent;
        this.currentOpponentId = opponentId;
        this.currentMatchId = matchId;

        // ✅ Notify UI immediately
        if (this.matchFoundCallback) {
          console.log("[net.js] Calling matchFoundCallback");
          this.matchFoundCallback({ 
            opponent: opponent,
            opponentId: opponentId,
            matchId: matchId 
          });
        }

        // ✅ CRITICAL: Send acceptance before joining battle room
        console.log("[net.js] Accepting match:", matchId);
        matchRoom.send("match_accepted", { matchId });
      });

      // ✅ Listen for game_start (only after both players accept)
      matchRoom.onMessage("game_start", async (msg) => {
        console.log("[net.js] Game start approved by server!", msg);
        const { matchId, roomId } = msg;

        try {
          // ✅ Use joinOrCreate with specific room criteria
          console.log("[net.js] Joining battle room:", matchId);
          const battleRoom = await this.client.joinOrCreate("battle", { 
            name: playerName,
            matchId: matchId,
          });
          
          this.battleRoom = battleRoom;
          this.room = battleRoom;
          console.log("[net.js] ✅ Joined battle room:", battleRoom.roomId, "Session:", battleRoom.sessionId);
          
          console.log("[net.js] Successfully joined battle room:", battleRoom.roomId);

          // ✅ Set up state sync for battle room
          battleRoom.onStateChange((state) => {
            console.log("[net.js] Battle state changed, players count:", state.players.size);
            this.players.clear();
            state.players.forEach((p, id) => {
              this.players.set(id, {
                x: p.x,
                y: p.y,
                hp: p.hp,
                alive: p.alive,
                name: p.name,
              });
            });
            
            // ✅ Sync objective state
            if (state.objective) {
              this.objective = {
                x: state.objective.x,
                y: state.objective.y,
                hp: state.objective.hp,
                alive: state.objective.alive,
              };
            }
            
            console.log("[net.js] Total players in battle:", this.players.size);
          });

          // ✅ Wire shot listener for battle room
          battleRoom.onMessage("shot", (msg) => {
            console.log("[net.js] Shot event in battle:", msg);
            this.onShotCallbacks.forEach(cb => {
              try {
                cb(msg);
              } catch (err) {
                console.error("[net.js] Error in shot callback:", err);
              }
            });
          });

          // ✅ Wire objective destroyed listener
          battleRoom.onMessage("objective_destroyed", (msg) => {
            console.log("[net.js] 🎉 Objective destroyed! Potion at:", msg);
            if (this.objectiveDestroyedCallback) {
              this.objectiveDestroyedCallback(msg);
            }
          });

          battleRoom.onLeave((code) => {
            console.warn("[net.js] Left battle room, code:", code);
            this.battleRoom = null;
            this.room = this.matchmakingRoom; // Revert to matchmaking
          });

          battleRoom.onError((code, message) => {
            console.error("[net.js] Battle room error:", code, message);
            this.battleRoom = null;
          });
        } catch (err) {
          console.error("[net.js] ❌ Failed to join battle room:", err);
          this.battleRoom = null;
          // Remain in matchmaking and try again
        }
      });

      matchRoom.onLeave((code) => {
        console.warn("[net.js] Left matchmaking, code:", code);
        this.matchmakingRoom = null;
        connectingPromise = null;
      });

      matchRoom.onError((code, message) => {
        console.error("[net.js] Matchmaking error:", code, message);
        connectingPromise = null;
      });

      // Step 3: Send join_queue message to enter matchmaking
      console.log("[net.js] Sending join_queue to find match...");
      matchRoom.send("join_queue", { name: playerName });

      return matchRoom;
      } catch (error) {
        console.error("[net.js] ❌ CONNECTION ERROR:", error);
        connectingPromise = null;
        throw error; // Re-throw so StartScene can catch it
      }
    })();

    return connectingPromise;
  },

  sendMove(x, y) {
    if (!this.room) return;
    this.room.send("move", { x, y });
  },
};
