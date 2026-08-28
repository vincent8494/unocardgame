import '../styles/rules.css'

/* Kept from the original build, rewritten to describe the rules this engine
   actually enforces — the old copy claimed 2-10 players and a 30s splash. */
export default function Rules({ onClose }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="How to play" onClick={onClose}>
      <div className="card-surface rules-panel" onClick={e => e.stopPropagation()}>
        <h2>How to play</h2>

        <div className="rules-body">
          <section>
            <h3>Goal</h3>
            <p>Be first to empty your hand. You score the value of every card still held by everyone else. First to {500} points wins the game.</p>
          </section>

          <section>
            <h3>Setup</h3>
            <ul>
              <li>2–4 players — fill empty seats with bots</li>
              <li>108 cards, 7 dealt to each player</li>
              <li>One card is flipped to start the discard pile</li>
            </ul>
          </section>

          <section>
            <h3>Your turn</h3>
            <ul>
              <li>Play a card matching the <strong>colour</strong>, <strong>number</strong>, or <strong>symbol</strong> on the discard</li>
              <li>Wilds can always be played — you choose the new colour</li>
              <li>Cards you cannot play are dimmed</li>
              <li>No legal card? Draw one. If it can be played you may play it, otherwise your turn ends</li>
            </ul>
          </section>

          <section>
            <h3>Action cards</h3>
            <dl className="rules-cards">
              <div><dt>Skip</dt><dd>Next player loses their turn</dd></div>
              <div><dt>Reverse</dt><dd>Flips direction — acts as a skip in a two-player game</dd></div>
              <div><dt>Draw Two</dt><dd>Next player draws 2 and is skipped</dd></div>
              <div><dt>Wild</dt><dd>Choose the colour in play</dd></div>
              <div><dt>Wild Draw Four</dt><dd>Choose the colour; next player draws 4 and is skipped</dd></div>
            </dl>
          </section>

          <section>
            <h3>Calling UNO</h3>
            <p>Press <strong>UNO!</strong> as you go down to one card. Forget, and any opponent can catch you — you draw 2. You get a couple of seconds to call it late and save yourself.</p>
            <p>Bots forget too, at about the same rate you will. When one does, a <strong>Catch</strong> button appears on their seat — take it before another bot does.</p>
          </section>

          <section>
            <h3>Scoring</h3>
            <p>Number cards score their face value, action cards 20, wilds 50.</p>
          </section>
        </div>

        <button className="btn btn-primary" onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}
