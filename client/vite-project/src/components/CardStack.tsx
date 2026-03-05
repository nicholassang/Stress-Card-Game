import type { CardStackProps } from "../types/gameTypes";
import { Card } from "./Card";

export const CardStack: React.FC<CardStackProps> = ({
    stack,
    stackIndex,
    draggable = false,
    onDragStart,
    onDrop,
    onMouseDown,
    className,
    winner
  }) => {
    return (
      <div
        draggable={false}
        onDragStart={() => onDragStart?.(stackIndex)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop?.(stackIndex)}
        onMouseDown={(e) => {
          if (winner) return;
          onMouseDown?.(e);
          e.preventDefault(); 
        }}
        className={className}     
        style={{
          position: "relative",
          width: "7em",
          height: "11em",
          cursor: draggable ? "grab" : "default",
          userSelect: "none",
        }}
      >
        {stack.map((card: string, index: number) => (
          <div
            key={`${card}-${index}`}
            style={{
              position: "absolute",
              top: -index * 3,
              left: index * 2,
              zIndex: index,
            }}
          >
            <Card label={card} winner={winner}/>
          </div>
        ))}
      </div>
    );
};