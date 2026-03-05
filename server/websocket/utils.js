const { drawFromDeckOrHand, isPlayable, hasAnyPlayableMove } = require("./gameLogic");

let broadcastRoom; 

function setUtilsState(state) {
  broadcastRoom = state.broadcastRoom;
}

function handleTimeUp(roomId, rooms) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timeInterval) {
    clearInterval(room.timeInterval);
    room.timeInterval = null;
  }

  const game = room.game_state;

  const playerIds = Object.keys(game).filter(id => id !== "center");
  const counts = playerIds.map(id => 
    game[id].deck.length +
    game[id].hand.reduce((sum, stack) => sum + stack.length, 0)
  );

  let winner;
  if (counts[0] < counts[1]) winner = playerIds[0];
  else if (counts[1] < counts[0]) winner = playerIds[1];
  else winner = null;

  broadcastRoom(roomId, { type: "GAME_END", winner });
}

function checkForGameEnd(room, roomId) {
  const game = room.game_state;
  const playerIds = Object.keys(game).filter(id => id !== "center");

  for (const pid of playerIds) {
    const player = game[pid];

    const handCount = player.hand.reduce((sum, stack) => sum + stack.length, 0);

    if (player.deck.length === 0 && handCount === 0) {
      const winner = playerIds.find(id => id !== pid) || null; // fixed

      // Stop timer
      if (room.timeInterval) {
        clearInterval(room.timeInterval);
        room.timeInterval = null;
      }

      broadcastRoom(roomId, { type: "GAME_END", winner });

      return true;
    }
  }

  return false;
}


function broadcastCountdown(roomId, seconds) {
  broadcastRoom(roomId, {
    type: "COUNTDOWN",
    seconds,
    message: `Refilling pile in ${seconds}...`
  });
}

function computeStressAvailable(game) {
  const pile1 = game.center.pile1;
  const pile2 = game.center.pile2;

  const pile1Top = pile1.cards[0];
  const pile2Top = pile2.cards[0];

  if (!pile1Top || !pile2Top) return false;

  if (pile1Top.slice(0, -1) !== pile2Top.slice(0, -1)) {
    return false;
  }

  if (hasAnyPlayableMove(game)) {
    return false;
  }

  return true;
}

// Ensure center piles always have playable cards
async function ensurePlayableState(room, roomId) {
  if (room.countdownActive) return;

  const game = room.game_state;
  const piles = ["pile1", "pile2"];
  const playerIds = Object.keys(game).filter(id => id !== "center");

  // Fill empty piles immediately with one card from each player's deck
  for (let i = 0; i < piles.length; i++) {
    const pile = piles[i];
    const pid = playerIds[i];
    if (!pid) continue;

    if (game.center[pile].cards.length === 0) {
      const card = drawFromDeckOrHand(game[pid]);
      if (card) game.center[pile].cards.unshift(card);

      // Check if player has zero cards
      const player = game[pid];
      const handCount = player.hand.reduce((sum, stack) => sum + stack.length, 0);
      if (player.deck.length === 0 && handCount === 0) {
        if (room.timeInterval) {
          clearInterval(room.timeInterval);
          room.timeInterval = null;
        }
        const winnerId = playerIds.find(id => id !== pid) || null;
        broadcastRoom(roomId, {
          type: "GAME_END",
          winner: winnerId
        });
        return; 
      }
    }
    game.center[pile].autoRefilled = true;
  }

  // Check if any pile is playable
  const anyPlayable = piles.some(pile => {
    const topCard = game.center[pile].cards[0];
    if (!topCard) return false;
    return playerIds.some(pid =>
      game[pid].hand.some(stack =>
        stack.length > 0 && isPlayable(stack[0], topCard)
      )
    );
  });

  // Check if Stress Button is available
  let stressAvailable = false;
  const pile1Top = game.center.pile1.cards[0];
  const pile2Top = game.center.pile2.cards[0];
  if (pile1Top && pile2Top) {
    stressAvailable = pile1Top.slice(0, -1) === pile2Top.slice(0, -1);
  }

  // Trigger countdown if no playable cards and stress not available
  if (!anyPlayable && !stressAvailable) {
    console.log("No playable cards on both piles");

    room.countdownActive = true;
    for (let i = 3; i > 0; i--) {
      broadcastCountdown(roomId, i);
      await new Promise(res => setTimeout(res, 1000));
    }

    // Refill piles again
    for (let i = 0; i < piles.length; i++) {
      const pile = piles[i];
      const pid = playerIds[i];
      if (!pid) continue;
      const card = drawFromDeckOrHand(game[pid]);
      if (card) game.center[pile].cards.unshift(card);

      // Check for game end again after refill
      const player = game[pid];
      const handCount = player.hand.reduce((sum, stack) => sum + stack.length, 0);
      if (player.deck.length === 0 && handCount === 0) {
        if (room.timeInterval) {
          clearInterval(room.timeInterval);
          room.timeInterval = null;
        }
        const winnerId = playerIds.find(id => id !== pid) || null;
        broadcastRoom(roomId, {
          type: "GAME_END",
          winner: winnerId
        });
        return;
      }
    }

    broadcastRoom(roomId, { 
      type: "GAME_UPDATE", 
      state: game,
      stressAvailable: computeStressAvailable(game)
    });
    room.countdownActive = false;

    for (const pile of piles) {
      game.center[pile].autoRefilled = false;
    }

    // Edge Case: refilled decks still have no playable cards 
    await ensurePlayableState(room, roomId);  
  }
}

module.exports = {
  handleTimeUp,
  checkForGameEnd,
  broadcastCountdown,
  computeStressAvailable,
  ensurePlayableState,
  setUtilsState, 
};