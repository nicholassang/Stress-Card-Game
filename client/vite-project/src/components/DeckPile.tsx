import type { DeckPileProps } from "../types/gameTypes";

export const DeckPile: React.FC<DeckPileProps> = ({ 
    count, 
    label, 
    mirrored = false, 
    showCount = true,
    gameState
}) => {
    const maxVisible = 10; 
    const visibleCount = Math.min(count, maxVisible);

    return (
      <div style={{ position: "relative", width: "7em", height: "11em" }}>
        {[...Array(visibleCount)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: mirrored ? i * 2 : -i * 2,
              left: mirrored ? -i * 1.5 : i * 1.5,
              width: "7em",
              height: "9.8em",
              borderRadius: "20px",
              background: "gray",
              border: "1px solid black",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "white",
              fontWeight: "bold",
              zIndex: i,
              userSelect: "none",
            }}
          >
            {i === 0 && label ? label : ""}
          </div>
        ))}
        {showCount && gameState && (
          <div
            style={{
              position: "absolute",
              bottom: "-1.5em",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "0.8em",
              fontWeight: "bold",
              userSelect: 'none'
            }}
          >
            {count} cards
          </div>
        )}
      </div>
    );
};