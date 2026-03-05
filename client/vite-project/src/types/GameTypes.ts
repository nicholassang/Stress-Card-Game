type CardLabel = string;
type CardStackType = CardLabel[];

export interface PlayerState {
  deck: string[];
  hand: [CardStackType, CardStackType, CardStackType, CardStackType];
}

export interface CardStackProps {
  stack: string[];
  stackIndex: number;
  draggable?: boolean;
  onDragStart?: (stackIndex: number) => void;
  onDrop?: (stackIndex: number) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
  winner: string | null;
}

export interface HandRowProps {
  hand: PlayerState["hand"];
  top: string;
  isPlayer: boolean;
  setDraggedStackIndex: any,
  setDraggingCard: any,
  setFloatingCardPos: any,
  winner: any
}

interface CursorPosition {
  x: number;
  y: number;
}

export interface Opponents {
  [id: string]: CursorPosition;
}

interface Pile {
  cards: string[];
  autoRefilled: boolean;
}

export interface DeckPileProps {
  count: number;      
  label?: string;   
  mirrored?: boolean;
  showCount?: boolean; 
  gameState: any
}

export interface GameState {
  [playerId: string]: PlayerState | { pile1: Pile; pile2: Pile };
  center: {
    pile1: Pile;
    pile2: Pile;
  };
}

export interface CardProps {
  label: string;
  draggable?: boolean;
  onDragStart?: () => void;
  winner: string | null;
}

export interface MatchRecord {
  matchId: string;          
  opponentId: string;        
  result: "win" | "lose" | "tie";
  timestamp: number;         
  allowRematch: boolean;    
}