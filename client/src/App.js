import './App.css';
import { Route, Switch } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Homepage from './components/Homepage';
import Game from './components/Game';
import SplashScreen from './components/SplashScreen';

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  // Hide splash screen after 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  const handleSkipSplash = () => {
    setShowSplash(false);
  };

  return (
    <div className="App">
      {showSplash ? (
        <SplashScreen onSkip={handleSkipSplash} />
      ) : (
        <Switch>
          <Route path='/' exact component={Homepage} />
          <Route path='/play' exact component={Game} />
        </Switch>
      )}
    </div>
  );
};

export default App;
