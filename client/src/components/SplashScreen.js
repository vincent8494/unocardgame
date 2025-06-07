import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import '../styles/SplashScreen.css';
import GameRules from './GameRules';

// Import the logo directly from the assets
import cardBackImage from '../assets/card-back.png';

const SplashScreen = ({ onSkip }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const history = useHistory();
  const timerRef = useRef();
  
  const handleSkip = useCallback(() => {
    setIsVisible(false);
    if (onSkip) {
      onSkip();
    } else {
      history.push('/');
    }
  }, [onSkip, history]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Start the countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [handleSkip]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Handle click anywhere on the splash screen to show rules
  const handleClick = () => {
    setShowRules(true);
  };

  // Handle when rules are closed
  const handleRulesClose = () => {
    handleSkip();
  };

  if (!isVisible) return null;
  
  if (showRules) {
    return <GameRules onClose={handleRulesClose} />;
  }

  return (
    <div 
      className={`splash-screen ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      style={{
        '--card-background': `url(${cardBackImage})`
      }}
    >
      <div className="credit-text">
        Made by <span className="pulse">@marugevincent</span>
      </div>
      <div className="splash-content">
        <h1>UNO Card Game</h1>
        <p>Get ready to play the classic card game!</p>
        <div className="countdown">
          {!isHovered ? (
            `Continuing in ${countdown}s`
          ) : (
            'Click anywhere to continue'
          )}
        </div>
        <button 
          className="skip-button" 
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          aria-label="Skip intro"
        >
          Skip Intro
        </button>
      </div>
    </div>
  );
};

export default SplashScreen;
