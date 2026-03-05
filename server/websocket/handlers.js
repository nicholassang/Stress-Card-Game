const { createDeck, isPlayable, drawFromDeckOrHand, generateRoomCode } = require("./gameLogic");
const { nanoid } = require("nanoid");
const { 
  computeStressAvailable, 
  ensurePlayableState,
  setUtilsState,
  handleTimeUp,
  checkForGameEnd
} = require("./utils");

let rooms, waitingPlayers, broadcastRoom;

function setServerState(state) {
  rooms = state.rooms;
  waitingPlayers = state.waitingPlayers;
  broadcastRoom = state.broadcastRoom;

  setUtilsState({ broadcastRoom });
}

// Main handler function
async function handleMessage(ws, data) {
  switch (data.type) {
      case "CANCEL_HOST": {
        if (!ws.roomId) return;

        const room = rooms.get(ws.roomId);
        if (!room) return;

        rooms.delete(ws.roomId);
        ws.roomId = null;

        ws.send(JSON.stringify({
          type: "HOST_CANCELLED"
        }));
        break;
      }
      case "HOST_ROOM": {
        let roomId = "";
        do {
          roomId = generateRoomCode();
        } while (rooms.has(roomId));

        rooms.set(roomId, {
          players: [ws],
          playerOrder: [ws.id],
          countdownActive: false,
          game_state: null, 
          rematchVotes: new Set(),
          timeInterval: null,
        });
        ws.roomId = roomId;

        ws.send(JSON.stringify({
          type: "ROOM_HOSTED",
          roomId
        }));
        break;
      }

      case "JOIN_ROOM": {
        const roomId = data.roomId;
        const room = rooms.get(roomId);

        if (!room) {
          ws.send(JSON.stringify({
            type: "ERROR",
            message: "Room not found"
          }));
          return;
        }

        if (room.players.length >= 2) {
          ws.send(JSON.stringify({
            type: "ERROR",
            message: "Room full"
          }));
          return;
        }

        room.players.push(ws);
        room.playerOrder.push(ws.id);
        ws.roomId = roomId;

        const deck = createDeck();
        const playerADeck = deck.slice(0, 26);
        const playerBDeck = deck.slice(26, 52);
        const playerAHand = playerADeck.splice(0, 4);
        const playerBHand = playerBDeck.splice(0, 4);

        if (!room.players || room.players.length < 2) {
          console.warn("Not enough players", {
            roomId: room.id,
            players: room.players?.length ?? 0,
          });
          return;
        }

        const game_state = {
          [room.players[0].id]: {
            deck: playerADeck,
            hand: [
              [playerAHand[0]],
              [playerAHand[1]],
              [playerAHand[2]],
              [playerAHand[3]],
            ],
          },
          [room.players[1].id]: {
            deck: playerBDeck,
            hand: [
              [playerBHand[0]],
              [playerBHand[1]],
              [playerBHand[2]],
              [playerBHand[3]],
            ],
          },
          center: {
            pile1: { cards: [], autoRefilled: false },
            pile2: { cards: [], autoRefilled: false },
          },
        };

        room.game_state = game_state;

        await ensurePlayableState(room, roomId);

        // Set 10min timer
        const startTime = Date.now(); 
        const duration = 10 * 60 * 500; 

        room.startTime = startTime;
        room.duration = duration;

        room.timeInterval = setInterval(() => {
          const elapsed = Date.now() - room.startTime;
          const remaining = room.duration - elapsed;

          broadcastRoom(roomId, {
            type: "TIME_UPDATE",
            remainingTime: remaining
          });

          if (remaining <= 0) {
            clearInterval(room.timeInterval);
            handleTimeUp(roomId, rooms);
          }
        }, 1000);

        broadcastRoom(roomId, {
          type: "MATCH_FOUND",
          roomId,
          players: room.playerOrder,
          state: game_state,
        });

        broadcastRoom(roomId, {
          type: "GAME_UPDATE",
          state: room.game_state,
          stressAvailable: computeStressAvailable(room.game_state),
        });

        await ensurePlayableState(room, roomId);
        break;
      }
      case "CANCEL_FIND_MATCH": {
        const idx = waitingPlayers.indexOf(ws);
        if (idx !== -1) {
          waitingPlayers.splice(idx, 1);
        }
        break;
      }
      case "FIND_MATCH":
        if (waitingPlayers.length > 0) {
          const opponent = waitingPlayers.shift();
          const roomId = nanoid(4);

          const deck = createDeck();

          const playerADeck = deck.slice(0, 26);
          const playerBDeck = deck.slice(26, 52);

          const playerAHand = playerADeck.splice(0, 4);
          const playerBHand = playerBDeck.splice(0, 4);

          const room = {
            players: [ws, opponent],
            playerOrder: [ws.id, opponent.id],
            countdownActive: false,
            rematchVotes: new Set(),   
            timeInterval: null,
            game_state: {
              [ws.id]: {
                deck: playerADeck,
                hand: [
                  [playerAHand[0]],
                  [playerAHand[1]],
                  [playerAHand[2]],
                  [playerAHand[3]],
                ],
              },
              [opponent.id]: {
                deck: playerBDeck,
                hand: [
                  [playerBHand[0]],
                  [playerBHand[1]],
                  [playerBHand[2]],
                  [playerBHand[3]],
                ],
              },
              center: {
                pile1: { cards: [], autoRefilled: false },
                pile2: { cards: [], autoRefilled: false },
                },
            }
          };

          rooms.set(roomId, room);
          ws.roomId = roomId;
          opponent.roomId = roomId;

          await ensurePlayableState(room, roomId);  

          // Set 5min timer
          const startTime = Date.now(); 
          const duration = 10 * 60 * 10; 

          room.startTime = startTime;
          room.duration = duration;

          room.timeInterval = setInterval(() => {
            const elapsed = Date.now() - room.startTime;
            const remaining = room.duration - elapsed;

            broadcastRoom(roomId, {
              type: "TIME_UPDATE",
              remainingTime: remaining
            });

            if (remaining <= 0) {
              clearInterval(room.timeInterval);
              handleTimeUp(roomId, rooms);
            }
          }, 1000);

          broadcastRoom(roomId, {
            type: "MATCH_FOUND",
            roomId,
            players: room.playerOrder,
            state: room.game_state,
          });

          await ensurePlayableState(room, roomId);  
        } else {
          waitingPlayers.push(ws);
        }
        break;

      case "MOUSE_MOVE":
        if (!ws.roomId) return;
        const room = rooms.get(ws.roomId);
        if (!room) return;
        room.players.forEach((player) => {
          if (player !== ws && player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify({
              type: "MOUSE_UPDATE",
              playerId: ws.id,
              x: data.x,
              y: data.y
            }));
          }
        });
        break;

      case "PLAY_CARD": {
        const room = rooms.get(ws.roomId);
        if (!room) return;

        const player = room.game_state[ws.id];
        if (!player) return;

        const { fromStack, pile } = data;
        const stack = player.hand[fromStack];
        if (!stack || stack.length === 0) return;

        const card = stack[0]; 
        const topCard = room.game_state.center[pile].cards[0];

        if (topCard && !isPlayable(card, topCard)) {
          return;
        }

        stack.shift();

        if (stack.length === 0 && player.deck.length > 0) {
          stack.push(player.deck.shift());
        }

        room.game_state.center[pile].cards.unshift(card);

        if (checkForGameEnd(room, ws.roomId)) return;

        broadcastRoom(ws.roomId, {
          type: "GAME_UPDATE",
          state: room.game_state,
          stressAvailable: computeStressAvailable(room.game_state),
        });

        await ensurePlayableState(room, ws.roomId);
        break;
      }
      case "MERGE_HAND_STACK": {
        const room = rooms.get(ws.roomId);
        if (!room) return;

        const { fromStack, toStack } = data;
        const player = room.game_state[ws.id];
        if (!player) return;

        if (fromStack === toStack) return;

        const from = player.hand[fromStack];
        const to = player.hand[toStack];

        if (!from.length || !to.length) return;

        const fromValue = from[0].slice(0, -1);
        const toValue = to[0].slice(0, -1);

        if (fromValue === toValue) {
          to.unshift(...from);
          from.length = 0;

          if (player.deck.length > 0) {
            from.push(player.deck.shift());
          }
        } 
        else {
          [player.hand[fromStack], player.hand[toStack]] =
            [player.hand[toStack], player.hand[fromStack]];
        }

        broadcastRoom(ws.roomId, {
          type: "GAME_UPDATE",
          state: room.game_state,
          stressAvailable: computeStressAvailable(room.game_state)
        });

        break;
      }
      case "STRESS": {
          console.log("STRESS");
          const room = rooms.get(ws.roomId);
          if (!room) return;
          const game = room.game_state;

          const playerIds = Object.keys(game).filter(id => id !== "center"); // Move this up
          const opponentId = playerIds.find(id => id !== ws.id);
          if (!opponentId) return;
          const opponent = game[opponentId];
          if (!opponent) return;

          // Collect all center cards
          const collectedCards = [
            ...game.center.pile1.cards,
            ...game.center.pile2.cards,
          ];
          if (collectedCards.length === 0) return;

          // Add to opponent's deck (bottom of deck)
          opponent.deck.push(...collectedCards);

          // Clear center piles
          game.center.pile1.cards.length = 0;
          game.center.pile2.cards.length = 0;

          // Check for game end before refilling
          for (const pid of playerIds) {
            const player = game[pid];
            const handCount = player.hand.reduce((sum, stack) => sum + stack.length, 0);
            if (player.deck.length === 0 && handCount === 0) {
              if (room.timeInterval) {
                clearInterval(room.timeInterval);
                room.timeInterval = null;
              }
              broadcastRoom(ws.roomId, {
                type: "GAME_END",
                winner: playerIds.find(id => id !== pid) || null,
              });
              return;
            }
          }

          const piles = ["pile1", "pile2"];

          for (const pile of piles) {
            if (game.center[pile].length === 0) {
              for (const pid of playerIds) {
                const card = drawFromDeckOrHand(game[pid]);
                if (card) game.center[pile].cards.unshift(card);
              }
            }
          }

          await ensurePlayableState(room, ws.roomId);

          // Broadcast updated state
          broadcastRoom(ws.roomId, {
            type: "GAME_UPDATE",
            state: game,
            stressAvailable: computeStressAvailable(room.game_state)
          });
          break;
      }

      case "INVITE_REMATCH": {
        const room = rooms.get(ws.roomId);
        if (!room) return;
        if (!room.rematchVotes) {
          room.rematchVotes = new Set();
        }

        room.rematchVotes.add(ws.id);

        const opponent = room.players.find(p => p !== ws);
        if (opponent?.readyState === WebSocket.OPEN) {
          opponent.send(JSON.stringify({
            type: "REMATCH_INVITE"
          }));
        }

        ws.send(JSON.stringify({
          type: "REMATCH_PENDING"
        }));

        break;
      }
      case "ACCEPT_REMATCH": {
        const room = rooms.get(ws.roomId);
        if (!room) return;

        room.rematchVotes.add(ws.id);

        // Both players accepted
        if (room.rematchVotes.size === 2) {
          room.rematchVotes.clear();

          // Reset game state
          const deck = createDeck();
          const playerADeck = deck.slice(0, 26);
          const playerBDeck = deck.slice(26);

          const playerA = room.players[0];
          const playerB = room.players[1];

          room.game_state = {
            [playerA.id]: {
              deck: playerADeck.slice(4),
              hand: [
                [playerADeck[0]],
                [playerADeck[1]],
                [playerADeck[2]],
                [playerADeck[3]],
              ],
            },
            [playerB.id]: {
              deck: playerBDeck.slice(4),
              hand: [
                [playerBDeck[0]],
                [playerBDeck[1]],
                [playerBDeck[2]],
                [playerBDeck[3]],
              ],
            },
            center: {
              pile1: { cards: [], autoRefilled: false },
              pile2: { cards: [], autoRefilled: false },
            },
          };

          await ensurePlayableState(room, ws.roomId);

          // Restart timer
          room.startTime = Date.now();
          room.duration = 10 * 60 * 500;

          room.timeInterval = setInterval(() => {
            const remaining = room.duration - (Date.now() - room.startTime);
            broadcastRoom(ws.roomId, {
              type: "TIME_UPDATE",
              remainingTime: remaining
            });

            if (remaining <= 0) {
              clearInterval(room.timeInterval);
              handleTimeUp(roomId, rooms);
            }
          }, 1000);

          broadcastRoom(ws.roomId, {
            type: "REMATCH_START",
            state: room.game_state
          });
        }

        break;
      }
      case "LEAVE_ROOM": {
          if (!ws.roomId) break;
          const roomId = ws.roomId;  
          const room = rooms.get(roomId);
          if (!room) break;

          room.players = room.players.filter(p => p !== ws);
          room.playerOrder = room.playerOrder.filter(id => id !== ws.id);

          ws.roomId = null;

          if (room.players.length === 0 && room.timeInterval) {
              clearInterval(room.timeInterval);
              rooms.delete(roomId);
          }
          break;
      }
      default:
        console.log("Unknown type:", data.type);
  }
}

module.exports = { handleMessage, setServerState };