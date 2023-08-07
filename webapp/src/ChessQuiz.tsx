import { Chessboard } from 'kokopu-react';
import { Position, Game, Database, Variation, Node, pgnRead, exception, pgnWrite } from "kokopu";
import { useEffect, useMemo, useReducer, useState } from 'react';
import Select from 'react-select';

import * as kokopu from "kokopu";

(window as any).pgnRead = pgnRead;
(window as any).pgnWrite = pgnWrite;
(window as any).kokopu = kokopu;

const START_FEN = new Position().fen();

interface SavedPgn {
    title?: string;
    pgn?: string;
    saveDate?: string;
}

interface MoveAtPosition {
    position: Position;
    move: string;
}

function pgnReadSafe(pgn: string, doAlert: boolean): Database | undefined {
    try {
        const db = pgnRead(pgn.replace(`Variant "From Position"`, `Variant "Standard"`));
        db.game(0);
        return db;
    } catch (e) {
        if (!pgn.endsWith("*")) {
            return pgnReadSafe(pgn + " *", doAlert);
        }
        if (doAlert) {
            alert("Invalid PGN: " + (e as any).message);
        }
        return undefined;
    }
}

function convertMovesToPgn(moves: string[]) {
    let pgn = '';
  
    for (let i = 0; i < moves.length; i++) {
      if (i % 2 === 0) {
        pgn += Math.floor(i / 2) + 1 + '. ';
      }
  
      pgn += moves[i] + ' ';
    }
  
    return pgn.trim();
  }

function removeHeadersFromPgn(pgn: string) {
    // Split the PGN into lines
    const lines = pgn.split('\n');
  
    // Filter out lines that start with square brackets (headers)
    const filteredLines = lines.filter(line => !line.startsWith('['));
  
    // Join the filtered lines back into a PGN string
    const cleanedPgn = filteredLines.join('\n');
  
    return cleanedPgn;
  }

  interface ChessQuizState {
    position: Position;
    moveStack: MoveAtPosition[];
    movesByPosition: { [fen: string]: string[] };
    savedPgns: SavedPgn[];
    squareSize: number;
    pgn: string;
    db: Database | undefined;
    flipped: boolean;
    computerEnabled: boolean;
    showLastMoves: boolean;
    autoRandomPosition: boolean;
    selectedSavedPgn: SavedPgn | undefined;
}

const initialChessQuizState: ChessQuizState = {
    position: new Position(),
    moveStack: [] as MoveAtPosition[],
    movesByPosition: {} as { [fen: string]: string[] },
    savedPgns: [] as SavedPgn[],
    squareSize: 100,
    pgn: "",
    db: undefined as Database | undefined,
    flipped: false,
    computerEnabled: true,
    showLastMoves: true,
    autoRandomPosition: false,
    selectedSavedPgn: undefined,
};

type ChessQuizAction = { type: 'playMove', move: string } | { type: 'playComputerMove' } | { type: 'undoMove' } | { type: 'resetPosition' } | { type: 'setMovesByPosition', movesByPosition: { [fen: string]: string[] } } | { type: 'setSavedPgns', savedPgns: SavedPgn[] } | { type: 'setSquareSize', squareSize: number } | { type: 'setPgn', pgn: string } | { type: 'setDb', db: Database } | { type: 'setFlipped', flipped: boolean }
| { type: 'flip' } | { type: 'toggleComputer' } | {type: 'toggleShowLastMoves'} | {type: 'jumpToRandomPosition' } | { type: 'toggleautoRandomPosition' } | { type: 'setSelectedSavedPgn', selectedSavedPgn: SavedPgn | undefined };

function chessQuizReducer(state: ChessQuizState, action: ChessQuizAction): ChessQuizState {
    switch (action.type) {
        case 'playMove':
            if (!action.move) {
                throw new Error("No move specified");
            }
            const newPosition = new Position(state.position);
            newPosition.play(action.move);
            return {
                ...state,
                position: newPosition,
                moveStack: [...state.moveStack, {position: state.position, move: action.move}],
            };
        case 'playComputerMove':
            if (!state.computerEnabled) {
                return state;
            }
            const possibleMoves = state.movesByPosition[state.position.fen()];
            if (!possibleMoves) {
                return state;
            }
            const move = state.movesByPosition[state.position.fen()][Math.floor(Math.random() * possibleMoves.length)];
            return chessQuizReducer(state, { type: 'playMove', move });
        case 'undoMove':
            if (state.moveStack.length === 0) {
                return state;
            }
            return {
                ...state,
                position: state.moveStack[state.moveStack.length - 1].position,
                moveStack: state.moveStack.slice(0, -1),
            };
        case 'resetPosition':
            return {
                ...state,
                position: state.db === undefined ? new Position() : state.db.game(0).initialPosition(),
                moveStack: [],
            };
        case 'setMovesByPosition':
            return {
                ...state,
                movesByPosition: action.movesByPosition,
            };
        case 'setSavedPgns':
            return {
                ...state,
                savedPgns: action.savedPgns,
            };
        case 'setSquareSize':
            return {
                ...state,
                squareSize: action.squareSize,
            };
        case 'setPgn':
            return {
                ...state,
                pgn: action.pgn,
            };
        case 'setDb':
            return {
                ...state,
                db: action.db,
            };
        case 'setFlipped':
            return {
                ...state,
                flipped: action.flipped,
            };
        case 'flip':
            return {
                ...state,
                flipped: !state.flipped,
            };
        case 'toggleComputer':
            return {
                ...state,
                computerEnabled: !state.computerEnabled,
            };
        case 'toggleShowLastMoves':
            return {
                ...state,
                showLastMoves: !state.showLastMoves,
            };
        case 'jumpToRandomPosition':
            const playerTurn = state.flipped ? 'b' : 'w';
            const possibleFens = Object.keys(state.movesByPosition).filter(
                fen => {
                    const position = new Position(fen);
                    return position.fen() !== START_FEN && position.turn() === playerTurn;
                }
            );
            if (possibleFens.length === 0) {
                return state;
            }
            return {
                ...state,
                position: new Position(possibleFens[Math.floor(Math.random() * possibleFens.length)]),
                moveStack: [],
            };
        case 'toggleautoRandomPosition':
            return {
                ...state,
                autoRandomPosition: !state.autoRandomPosition,
            };
        case 'setSelectedSavedPgn':
            return {
                ...state,
                selectedSavedPgn: action.selectedSavedPgn,
            };
        default:
            throw new Error("Unknown action type: " + ((action as any)?.type));
    }
}

export function ChessQuiz() {

    const [ state, dispatch ] = useReducer(chessQuizReducer, initialChessQuizState);
    const [ showPgnImporter, setShowPgnImporter ] = useState(true);

    const { savedPgns, squareSize, pgn, db, flipped, movesByPosition, position, moveStack, showLastMoves, autoRandomPosition } = state;

    (window as any).position = position;
    (window as any).db = db;
    (window as any).game = db && db.game(0);

    function resetPosition() {
        dispatch({ type: 'resetPosition' });
    }

    function undoMove() {
        if (moveStack.length > 0) {
            dispatch({ type: 'undoMove' });
        }
    }

    function playMove(move: string) {
        dispatch({ type: 'playMove', move });
    }

    function handleMovePlayed(move: string) {
        playMove(move);
        const playerTurn = flipped ? 'b' : 'w';
        if (position.turn() === playerTurn) {
            if (autoRandomPosition) {
                // if the move was good, jump to a random position
                if (movesByPosition[position.fen()]?.includes(move)) {
                    setTimeout(() => {
                        dispatch({ type: 'jumpToRandomPosition' });
                    }, 500);
                }
            } else {
                setTimeout(() => {
                    dispatch({ type: 'playComputerMove' });
                }, 500);
            }
        }
    }

    function loadSavedPgns(pgnJson?: string | null) {
        if (pgnJson === null || pgnJson === undefined || pgnJson === "") {
            return;
        }
        const pgns = JSON.parse(pgnJson);
        dispatch({ type: 'setSavedPgns', savedPgns: pgns.reverse() });
    }

    window.addEventListener('storage', e => {
        if (e.key === 'pgns' && e.newValue !== null) {
            loadSavedPgns(e.newValue);
        }
    });

    useEffect(() => {
        const pgnsJson = localStorage.getItem("pgns");
        loadSavedPgns(pgnsJson);
        function onKeyDown(e: KeyboardEvent) {
            if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
                return;
            }
            if (e.key === 'ArrowLeft') {
                dispatch({ type: 'undoMove' });
            } else if (e.key === 'ArrowRight') {
                dispatch({ type: 'playComputerMove' });
            } else if (e.key === 'ArrowUp') {
                resetPosition();
            } else if (e.key === "ArrowDown") {
                dispatch({ type: 'jumpToRandomPosition' });
            } else if (e.key === 'f') {
                dispatch({ type: 'flip' });
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    function savePgnToLocalStorage(pgn: string) {
        const pgnsJson = localStorage.getItem("pgns");
        const pgns = JSON.parse(pgnsJson || "[]");
        const game = pgnReadSafe(pgn, true)?.game(0);
        if (!game) return;
        pgns.push({ title: game.event(), pgn: pgnWrite(game), saveDate: new Date().toISOString() });
        localStorage.setItem("pgns", JSON.stringify(pgns));
        loadSavedPgns(JSON.stringify(pgns));
    }

    function loadPgnToQuiz(pgn: string) {
        if (pgn === "") {
            return;
        }
        const newDb = pgnReadSafe(pgn, true);
        if (!newDb) throw new Error("Invalid PGN");
        try {
            for (let i = 0; i < newDb.gameCount(); i++) {
                newDb.game(i);
            }
        } catch (e) {
            if (e instanceof exception.InvalidPGN) {
                alert("Invalid PGN:" + e.message);
            } else {
                alert("Unknown error:" + e);
            }
            return;
        }
        dispatch({ type: 'setDb', db: newDb });

        const newMovesByPosition = {} as { [fen: string]: string[] };

        function processGame(game: Game) {
            processNode(game.nodes()[0], game.initialPosition());
        }

        function processNode(node: Node, previous: Position) {
            const fen = previous.fen();
            const notation = node.notation();
            if (fen in newMovesByPosition) {
                if (!newMovesByPosition[fen].includes(notation)) {
                    newMovesByPosition[fen].push(notation);
                }
            } else {
                newMovesByPosition[fen] = [notation];
            }
            const next = node.next();
            if (next) {
                processNode(next, node.position());
            }
            for (let variation of node.variations()) {
                processVariation(variation, previous);
            }
        }

        function processVariation(variation: Variation, previous: Position) {
            processNode(variation.nodes()[0], previous);
        }

        for (let game of newDb.games()) {
            processGame(game);
            dispatch({ type: 'setMovesByPosition', movesByPosition: newMovesByPosition });
            (window as any).movesByPosition = newMovesByPosition;
        }
        dispatch({ type: 'resetPosition' });
    }

    const gameSelectOptions = useMemo(() => savedPgns.map((pgn) => ({
                value: pgn,
                label: (pgn.saveDate ? new Date(pgn.saveDate).toLocaleString() + " - " : "")
                  + pgn.title + " - "
                  + (pgn.pgn ? pgnReadSafe(pgn.pgn, false)?.game(0).nodes(true).length : "0") + " moves - "
                  + removeHeadersFromPgn(pgn.pgn || "").slice(0, 30),
            })),
             [savedPgns]);

    const playerTurn = flipped ? 'b' : 'w';
    const lastMove = moveStack.slice(position.turn() === playerTurn ? -2 : -1)[0];
    const allowedLastMoves = movesByPosition[lastMove?.position?.fen()];
    const lastMoveWasFailure = lastMove && allowedLastMoves && !allowedLastMoves.includes(lastMove.move);
    const isEndOfLine = !(movesByPosition[position.fen()]?.length);

    // title, with backslashes and quotes unescaped
    const tmpTitle = pgn.match(/\[Event\s+"([^\n]*)"\]/)?.[1]?.replace(/\\"/g, "\"")?.replace(/\\\\/g, "\\");;

    return (
        <div>
            PGN Importer:&nbsp;
            <button onClick={() => setShowPgnImporter(!showPgnImporter)}>{ showPgnImporter ? "Hide" : "Show" }</button>
            <br/>
            { showPgnImporter && (<>
            <Select placeholder="Select a saved PGN" options={gameSelectOptions} onChange={(e) => {
                if(e && e.value && e.value.pgn) {
                    dispatch({ type: 'setSelectedSavedPgn', selectedSavedPgn: e.value });
                    dispatch({ type: 'setPgn', pgn: e.value.pgn });
                    try {
                        loadPgnToQuiz(e.value.pgn);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }}></Select>
            The quiz loads as soon as you select a PGN.&nbsp;
            <button onClick={() => {
                if (state.selectedSavedPgn && window.confirm("Are you sure you want to delete this PGN?")) {
                    const pgnsJson = localStorage.getItem("pgns");
                    const pgns = JSON.parse(pgnsJson || "[]");
                    const index = pgns.findIndex((pgn: SavedPgn | any) => pgn?.saveDate === state.selectedSavedPgn?.saveDate);
                    if (index !== -1) {
                        pgns.splice(index, 1);
                        localStorage.setItem("pgns", JSON.stringify(pgns));
                        loadSavedPgns(JSON.stringify(pgns));
                        dispatch({ type: 'setSelectedSavedPgn', selectedSavedPgn: undefined });
                        dispatch({ type: 'setPgn', pgn: "" });
                    }
                }
            }}>Delete</button>
            <br/><br/>
            <input style={{"width": "100%"}} onChange={(e) => {
                // fix backslashes and quotes
                const newTitle = e.target.value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                if (tmpTitle !== undefined) {
                    dispatch({ type: 'setPgn', pgn: pgn.replace(/\[Event\s+"([^\n]*)"\]/, `[Event "${newTitle}"]`) });
                } else {
                    dispatch({ type: 'setPgn', pgn: `[Event "${newTitle}"]\n${pgn}` });
                }
             }} value={tmpTitle || ""}></input>
            <br/>
            <textarea style={{"width": "100%"}} value={pgn} onChange={(e) => dispatch({ type: 'setPgn', pgn: e.target.value })} rows={10} cols={50}></textarea>
            <br/>
            <button onClick={() => {
                try {
                    loadPgnToQuiz(pgn);
                    savePgnToLocalStorage(pgn);
                } catch (e) {
                    console.error(e);
                }
            }}>Use and save PGN</button> You can create PGN for a quiz at <a href="https://lichess.org/analysis" target="_blank" rel="noreferrer">Lichess</a>, then load it here
            <br/>
            </>)}<br/>
            
            <button onClick={() => dispatch({type: 'setFlipped', 'flipped': !flipped})}>F: Flip</button>&nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={() => dispatch({type: 'setSquareSize', squareSize: squareSize * 1.1})}>+</button>&nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={() => dispatch({type: 'setSquareSize', squareSize: squareSize * 0.9})}>-</button>&nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={() => resetPosition()}>↑ Reset</button>&nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={() => undoMove()}>← Undo</button>&nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={() => dispatch({ type: 'playComputerMove' })}>→ Play random move</button>&nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={() => dispatch({ type: 'jumpToRandomPosition' })}>↓ Random position</button>&nbsp;&nbsp;&nbsp;&nbsp;
            <span onClick={() => dispatch({ type: 'toggleComputer' })}><input type="checkbox" checked={state.computerEnabled} onChange={(e) => {}}></input>Auto move enabled</span>&nbsp;&nbsp;&nbsp;&nbsp;
            <span onClick={() => dispatch({ type: 'toggleautoRandomPosition' })}><input type="checkbox" checked={state.autoRandomPosition} onChange={(e) => {}}></input>Auto random position</span>&nbsp;&nbsp;&nbsp;&nbsp;

            <br/>
            {
                convertMovesToPgn(moveStack.map(move => move.move))
            }
            <br/>
            <Chessboard
                squareSize={squareSize}
                flipped={flipped}
                position={position}
                interactionMode="playMoves"
                onMovePlayed={move => handleMovePlayed(move)}
                animated={true}
                moveArrowColor='b'
                moveArrowVisible={true}
            />
            <br/>
            <button onClick={() => undoMove()}>Undo</button>&nbsp;&nbsp;&nbsp;&nbsp;
            <br/>
            <div className={"feedback " + (lastMoveWasFailure ? "failure" : isEndOfLine ? "finished" : allowedLastMoves ? "success" : "unknown")}>
            Last move: { lastMove?.move }
            <br/>
            Move was in PGN: { allowedLastMoves ? (lastMove && allowedLastMoves?.includes(lastMove?.move) ? "Yes" : "No") : "Position not part of quiz" }
            <br/>
            Allowed last moves: {
                showLastMoves && (<>
                        { allowedLastMoves?.join(", ") }
                    </>)
            }
            &nbsp;
            <button onClick={() => dispatch({ type: 'toggleShowLastMoves' })}>{ showLastMoves ? "Hide" : "Show" }</button>
            <br/>
            End of line: { isEndOfLine ? "Yes" : "No" }
            </div>
        </div>
    )
}
