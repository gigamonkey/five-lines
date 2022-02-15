const TILE_SIZE = 30;
const FPS = 30;
const MILLIS_PER_FRAME = 1000 / FPS;

enum Tile {
  AIR,
  FLUX,
  UNBREAKABLE,
  PLAYER,
  STONE,
  BOX,
  KEY1,
  LOCK1,
  KEY2,
  LOCK2,
}

const canBeOccupied = new Set<Tile>([Tile.AIR, Tile.FLUX, Tile.KEY1, Tile.KEY2]);

const locksAndKeys: Map<Tile, Tile> = new Map<Tile, Tile>([
  [Tile.KEY1, Tile.LOCK1],
  [Tile.KEY2, Tile.LOCK2],
]);

const tileColors = new Map<Tile, string>([
  [Tile.FLUX, "#ccffcc"],
  [Tile.UNBREAKABLE, "#999999"],
  [Tile.PLAYER, "#ff0000"],
  [Tile.STONE, "#0000cc"],
  [Tile.BOX, "#8b4513"],
  [Tile.KEY1, "#ffccdd"],
  [Tile.LOCK1, "#ffcc00"],
  [Tile.KEY2, "#ddccff"],
  [Tile.LOCK2, "#00ccff"],
]);

type Thunk = () => void;

const Input = {
  UP: () => board.move(0, -1),
  DOWN: () => board.move(0, 1),
  LEFT: () => board.move(-1, 0),
  RIGHT: () => board.move(1, 0),
}

const keyMap: Map<string, Input> = new Map<string, Input>([
  ["ArrowUp", Input.UP],
  ["w", Input.UP],
  ["ArrowDown", Input.DOWN],
  ["s", Input.DOWN],
  ["ArrowLeft", Input.LEFT],
  ["a", Input.LEFT],
  ["ArrowRight", Input.RIGHT],
  ["d", Input.RIGHT],
]);

let inputs: Thunk[] = [];

class Cell {
  x: number;
  y: number;
  tiles: Tile[][];

  constructor(x: number, y: number, map: Tile[][]) {
    this.x = x;
    this.y = y;
    this.tiles = map;
  }

  dx(d: number): Cell {
    return new Cell(this.x + d, this.y, this.tiles);
  }

  dy(d: number): Cell {
    return new Cell(this.x, this.y + d, this.tiles);
  }

  below() { 
    return this.dy(1); 
  }

  tile() {
    return this.tiles[this.y][this.x];
  }

  is(tile: Tile) {
    return this.tile() === tile;
  }

  setTile(tile: Tile) {
    this.tiles[this.y][this.x] = tile;
  }

  clear() {
    this.setTile(Tile.AIR);
  }
}

type CellPredicate = (c: Cell) => boolean;

class Board {
  tiles: Tile[][];
  player: Cell;

  constructor(tiles: Tile[][]) {
    this.tiles = tiles;
    // This assumes there's only one player in the map.
    this.player = this.cells(c => c.is(Tile.PLAYER)).next().value;
  }

  draw(g: CanvasRenderingContext2D) {
    for (let c of this.cells(c => tileColors.has(c.tile()))) {
      g.fillStyle = tileColors.get(c.tile());
      g.fillRect(c.x * TILE_SIZE, c.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  move(dx: number, dy: number) {
    const goingTo = this.player.dx(dx).dy(dy);
    if (canBeOccupied.has(goingTo.tile())) {
      this.movePlayerTo(goingTo);
    } else if (dx !== 0 && canPush(goingTo, dx)) {
      moveTile(goingTo, goingTo.dx(dx));
      this.movePlayerTo(goingTo);
    }
  }

  movePlayerTo(c: Cell) {
    this.maybeUnlock(c.tile());
    moveTile(this.player, c);
    this.player = c;
  }

  maybeUnlock(current: Tile) {
    if (locksAndKeys.has(current)) {
      this.remove(locksAndKeys.get(current));
    }
  }

  dropTilesOneCell() {
    for (let c of this.cells(c => canFall(c.tile()))) {
      if (c.y < this.tiles.length - 1) {
        let below = c.below();
        if (below.is(Tile.AIR)) {
          moveTile(c, below);
        }
      }
    }
  }

  remove(tile: Tile) {
    for (let c of this.cells(c => c.is(tile))) {
      c.clear();
    }
  }

  cell(x: number, y: number): Cell {
    return new Cell(x, y, this.tiles);
  }

  *cells(p: CellPredicate): Generator<Cell> {
    for (let y = 0; y < this.tiles.length; y++) {
      for (let x = 0; x < this.tiles[y].length; x++) {
        let cell = this.cell(x, y);
        if (p(cell)) {
          yield cell;
        }
      }
    }
  }


}

let board: Board = new Board([
  [2, 2, 2, 2, 2, 2, 2, 2],
  [2, 3, 0, 1, 1, 2, 0, 2],
  [2, 4, 2, 5, 1, 2, 0, 2],
  [2, 6, 4, 1, 1, 2, 0, 2],
  [2, 4, 1, 1, 1, 7, 0, 2],
  [2, 2, 2, 2, 2, 2, 2, 2],
]);



function moveTile(from: Cell, to: Cell) {
  to.setTile(from.tile())
  from.clear();
}



function canPush(goingTo: Cell, dx: number): boolean {
  const isPushable = goingTo.is(Tile.STONE) || goingTo.is(Tile.BOX);
  const emptyAfter = goingTo.dx(dx).is(Tile.AIR);
  const emptyBelow = goingTo.below().is(Tile.AIR); // FIXME seems like this can't happen unless the block is floating already.

  return isPushable && emptyAfter && !emptyBelow;
}

function update() {
  processInputs();
  board.dropTilesOneCell();
}

function processInputs() {
  while (inputs.length > 0) {
    inputs.pop()();
  }
}

function canFall(tile: Tile) {
  return tile === Tile.STONE || tile === Tile.BOX;
}

function draw() {
  let canvas = document.getElementById("GameCanvas") as HTMLCanvasElement;
  let g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  board.draw(g);
}

function gameLoop() {
  let start = Date.now();
  update();
  draw();
  setTimeout(gameLoop, Math.max(0, (start + MILLIS_PER_FRAME) - Date.now()));
}

function keyHandler(e: KeyboardEvent) {
  if (keyMap.has(e.key)) {
    inputs.push(keyMap.get(e.key));
  }
}

window.onload = gameLoop;
window.onkeydown = keyHandler;

