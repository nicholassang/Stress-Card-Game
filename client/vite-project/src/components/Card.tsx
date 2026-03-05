import type { CardProps } from "../types/gameTypes";

export const Card: React.FC<CardProps> = ({ 
    label,
    draggable,
    onDragStart,
    winner
  }) => (
    <div
      draggable={draggable ?? false}
      onDragStart={onDragStart}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        border: "1px solid black",
        height: "9.8em",
        width: "7em",
        background: "white",
        borderRadius: "20px",
        cursor: draggable ? "grab" : "default",
        userSelect: "none",
        color: "black",
        fontSize: "1em",
      }}
      onMouseDown={(e) => {
        if (winner) return;
        e.preventDefault()
      }}
    >
      {label}
    </div>
);