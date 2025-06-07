import React from 'react';
import { useHistory } from 'react-router-dom';
import '../styles/GameRules.css';

const GameRules = ({ onClose }) => {
  const history = useHistory();

  const handleContinue = () => {
    if (onClose) {
      onClose();
    } else {
      history.push('/');
    }
  };

  return (
    <div className="game-rules" onClick={handleContinue}>
      <div className="rules-content" onClick={e => e.stopPropagation()}>
        <h2>UNO Card Game Rules</h2>
        
        <div className="rules-scrollable">
          <section>
            <h3>Objective of the Game</h3>
            <p>Be the first player to get rid of all your cards. Points are scored based on the cards left in opponents' hands.</p>
          </section>

          <section>
            <h3>Game Setup</h3>
            <ul>
              <li><strong>Players:</strong> 2 to 10</li>
              <li><strong>Cards:</strong> 108 cards total</li>
              <li>Each player is dealt <strong>7 cards</strong></li>
              <li>Remaining cards form a <strong>draw pile</strong></li>
              <li>Top card of draw pile is flipped to start the <strong>discard pile</strong></li>
            </ul>
          </section>

          <section>
            <h3>Game Play</h3>
            <ol>
              <li>Players take turns <strong>clockwise</strong></li>
              <li>On your turn, play a card that matches the <strong>color</strong>, <strong>number</strong>, or <strong>symbol</strong></li>
              <li>Or play a <strong>Wild</strong> or <strong>Wild Draw Four</strong> card</li>
              <li>If you can't play, draw one card</li>
            </ol>
          </section>

          <section className="special-cards">
            <h3>Special Cards</h3>
            <div className="card-grid">
              <div className="card-rule">
                <h4>Skip</h4>
                <p>Next player loses their turn</p>
              </div>
              <div className="card-rule">
                <h4>Reverse</h4>
                <p>Reverses the direction of play</p>
              </div>
              <div className="card-rule">
                <h4>Draw Two</h4>
                <p>Next player draws 2 cards and skips turn</p>
              </div>
              <div className="card-rule">
                <h4>Wild</h4>
                <p>Choose the next color</p>
              </div>
              <div className="card-rule">
                <h4>Wild Draw Four</h4>
                <p>Choose color, next player draws 4 cards</p>
              </div>
            </div>
          </section>

          <section>
            <h3>UNO Rule</h3>
            <p>When you have <strong>one card left</strong>, you <strong>must shout "UNO!"</strong> If caught, draw <strong>2 penalty cards</strong>.</p>
          </section>

          <section>
            <h3>Scoring</h3>
            <ul>
              <li><strong>Number Cards:</strong> Face value (0-9)</li>
              <li><strong>Action Cards:</strong> 20 points each</li>
              <li><strong>Wild Cards:</strong> 50 points each</li>
            </ul>
            <p>First to <strong>500 points</strong> wins the game!</p>
          </section>
        </div>

        <button 
          className="continue-button" 
          onClick={handleContinue}
        >
          Continue to Game
        </button>
      </div>
    </div>
  );
};

export default GameRules;
