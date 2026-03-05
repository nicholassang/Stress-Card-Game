function createDeck() {
  const suits = ["♠","♥","♦","♣"];
  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const deck = [];
  for (const suit of suits) for (const value of values) deck.push(`${value}${suit}`);
  return shuffle(deck);
}

function shuffle(array) {
  for (let i=array.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
  return array;
}

function getRank(card){
  if(!card) return null;
  const rank=card.slice(0,-1);
  if(rank==='A') return 1;
  if(rank==='J') return 11;
  if(rank==='Q') return 12;
  if(rank==='K') return 13;
  return parseInt(rank);
}

function isPlayable(draggedCard, topCard){
  const d=getRank(draggedCard), t=getRank(topCard);
  if(d==null||t==null) return false;
  return Math.abs(d-t)===1||(d===1&&t===13)||(d===13&&t===1);
}

function drawFromDeckOrHand(player){
  if(player.deck.length>0) return player.deck.shift();
  const nonEmptyStacks=player.hand.filter(s=>s.length>0);
  if(nonEmptyStacks.length===0) return null;
  const stack=nonEmptyStacks[Math.floor(Math.random()*nonEmptyStacks.length)];
  return stack.shift();
}

function generateRoomCode(length=5){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<length;i++) code+=chars.charAt(Math.floor(Math.random()*chars.length));
  return code;
}

function hasAnyPlayableMove(game){
  const piles=["pile1","pile2"];
  const playerIds=Object.keys(game).filter(id=>id!=="center");
  return piles.some(pile=>{
    const topCard=game.center[pile].cards[0];
    if(!topCard) return false;
    return playerIds.some(pid=>game[pid].hand.some(s=>s.length>0 && isPlayable(s[0],topCard)));
  });
}

module.exports = { createDeck, shuffle, isPlayable, drawFromDeckOrHand, generateRoomCode, hasAnyPlayableMove };