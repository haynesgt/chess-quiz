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
      You can create a quiz at <a href="https://lichess.org/analysis" target="_blank">Lichess</a> and load it here
    </div>
    </div>
  );
}

export default App;
