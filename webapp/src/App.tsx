import React from 'react';
import './App.css';
import { ChessQuiz } from './ChessQuiz';

function App() {
  return (
    <div className="App">
    <ChessQuiz></ChessQuiz>
    <div className="footer">
      Keyboard commands: <br/>
      <ul>
        <li>Left arrow: undo</li>
        <li>Right arrow: random move</li>
        <li>Up arrow: Reset</li>
        <li>f: flip side</li>
      </ul>
    </div>
    </div>
  );
}

export default App;
