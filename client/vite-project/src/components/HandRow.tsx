import type { Key } from "react";
import { CardStack } from "./CardStack";
import type { HandRowProps } from "../types/gameTypes";

export const HandRow: React.FC<HandRowProps> = ({
    hand,
    top,
    isPlayer,
    setDraggedStackIndex,
    setDraggingCard,
    setFloatingCardPos,
    winner
  }) => {
    return (
      <div
        style={{
          display: "flex",
          position: "absolute",
          top,
          left: "50%",
          transform: "translate(-50%, -50%)",
          gap: "5em",
        }}
      >
        {hand.map((stack: string[], index: number ) => (
          <CardStack
            key={index}
            stack={stack}
            stackIndex={index}
            draggable={false} 
            onDragStart={undefined}
            onMouseDown={(e) => {
              if (winner) return;
              if (isPlayer && stack.length > 0) {
                setDraggedStackIndex(index);
                setDraggingCard({ label: stack[0], originStack: index });
                setFloatingCardPos({ x: e.clientX, y: e.clientY });
              }
            }}
            className="hand-stack"
            winner={winner}
          />
        ))}
      </div>
    );
  };