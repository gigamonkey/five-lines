type Action = () => void;
type CellPredicate = (c: Cell) => boolean;
type Painter = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => void;

const TILE_SIZE = 30;
const FPS = 30;
const MILLIS_PER_FRAME = 1000 / FPS;

enum Kind { CONSUMABLE, PUSHABLE, IMMOVABLE, PLAYER, EMPTY };

/*
 * The distinct tiles that can exist. There should only be one instance of each type.
 */
class Tile {
  color: string;
  kind: Kind;
  unlocks: Tile = null;
  painter: Painter = squarePainter;

  static keyFor(lock: Tile) {
    const key = new Tile(lock.color, Kind.CONSUMABLE);
    key.unlocks = lock;
    key.painter = circlePainter;
    return key;
  }

  constructor(color: string, kind: Kind) {
    this.color = color;
    this.kind = kind;
  }

  draw(g: CanvasRenderingContext2D, x: number, y: number) {
    this.painter(g, this.color, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }
}

function squarePainter(g: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function circlePainter(g: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  g.beginPath();
  g.arc(x + w / 2, y + h / 2, w / 2, 0, 2 * Math.PI, true);
  g.fillStyle = color;
  g.fill();
}


/*
 * The cells of the board. Each has an x,y coordinate and a reference back to
 * the board in order to get at the underlying tiles.
 */
class Cell {
  x: number;
  y: number;
  board: Board;

  constructor(x: number, y: number, board: Board) {
    this.x = x;
    this.y = y;
    this.board = board;
  }

  draw(g: CanvasRenderingContext2D) {
    this.tile().draw(g, this.x, this.y);
  }

  dx(d: number): Cell {
    return new Cell(this.x + d, this.y, this.board);
  }

  dy(d: number): Cell {
    return new Cell(this.x, this.y + d, this.board);
  }

  below() {
    return this.dy(1);
  }

  tile() {
    return this.board.tiles[this.y][this.x];
  }

  is(kind: Kind) {
    return this.tile().kind === kind;
  }

  isEmpty() {
    return this.is(Kind.EMPTY);
  }

  setTile(tile: Tile) {
    this.board.tiles[this.y][this.x] = tile;
  }

  clear() {
    this.setTile(board.emptyTile);
  }

  moveTile(to: Cell) {
    to.setTile(this.tile())
    this.clear();
  }

  canBeConsumed() {
    return this.tile().kind == Kind.CONSUMABLE;
  }

  canFall() {
    return this.tile().kind == Kind.PUSHABLE;
  }

  canBePushed(dx: number): boolean {
    // FIXME I'm not sure what the check for the cell below not being empty is
    // about as it seems like it must always be true unless the block is
    // floating already.
    const after = this.dx(dx);
    const below = this.below();
    return this.canFall() && after.isEmpty() && !below.isEmpty();
  }
}

/*
 * The board itself.
 */
class Board {
  tiles: Tile[][];
  player: Cell;
  emptyTile: Tile;
  settled: boolean = true;

  constructor(numbers: number[][], emptyTile: Tile, tileTypes: Tile[]) {
    this.tiles = numbers.map(row => row.map(n => tileTypes[n]));
    let players = this.cells(c => c.is(Kind.PLAYER));
    this.player = players.next().value;
    console.assert(players.next().done, "Should only be one player");
    this.emptyTile = emptyTile;
  }

  draw(g: CanvasRenderingContext2D) {
    for (let c of this.cells(() => true)) {
      c.draw(g);
    }
  }

  move(dx: number, dy: number) {
    const goingTo = this.player.dx(dx).dy(dy);
    this.pushIfNeeded(dx, goingTo);
    this.moveIfPossible(goingTo);
  }

  pushIfNeeded(dx: number, goingTo: Cell) {
    if (dx !== 0 && goingTo.canBePushed(dx)) {
      goingTo.moveTile(goingTo.dx(dx));
    }
  }

  moveIfPossible(goingTo: Cell) {
    if (goingTo.isEmpty() || goingTo.canBeConsumed()) {
      this.movePlayerTo(goingTo);
    }
  }

  movePlayerTo(c: Cell) {
    this.maybeUnlock(c.tile());
    this.player.moveTile(c);
    this.player = c;
  }

  maybeUnlock(current: Tile) {
    if (current.unlocks !== null) {
      this.remove(current.unlocks);
    }
  }

  dropTilesOneCell() {
    // Assume nothing drops. Will get set to false in dropCell if anything does.
    this.settled = true;

    // Work from the bottom up so tiles above other tiles that drop will also drop.
    for (let y = this.tiles.length - 2; y >= 0; y--) {
      this.dropRow(y);
    }
  }

  dropRow(y: number) {
    for (let x = 0; x < this.tiles[y].length; x++) {
      this.dropCell(x, y);
    }
  }

  dropCell(x: number, y: number) {
    let c = new Cell(x, y, this);
    if (c.canFall()) {
      let below = c.below();
      if (below.isEmpty()) {
        c.moveTile(below);
        this.settled = false;
      }
    }
  }

  remove(tile: Tile) {
    for (let c of this.cells(c => c.tile() === tile)) {
      c.clear();
    }
  }

  cell(x: number, y: number): Cell {
    return new Cell(x, y, this);
  }

  *cells(p: CellPredicate): Generator<Cell> {
    for (let y = 0; y < this.tiles.length; y++) {
      for (let x = 0; x < this.tiles[y].length; x++) {
        let cell = this.cell(x, y);
        if (p(cell)) yield cell;
      }
    }
  }
}

class Keybindings {
  bindings: Map<string, Action> = new Map<string, Action>();
  actions: Action[] = [];

  bindKeys(keys: string[], action: Action) {
    keys.forEach(k => this.bindings.set(k, action));
  }

  handle(e: KeyboardEvent) {
    if (this.bindings.has(e.key)) {
      this.actions.push(this.bindings.get(e.key));
    }
  }

  doActions() {
    while (this.actions.length > 0) {
      this.actions.shift()();
    }
  }
}


//
// Main
// 

const canvas = document.getElementById("GameCanvas") as HTMLCanvasElement;
const g = canvas.getContext("2d");

const AIR = new Tile("#ffffff", Kind.EMPTY);
const LOCK1 = new Tile("#ffcc00", Kind.IMMOVABLE);
const LOCK2 = new Tile("#00ccff", Kind.IMMOVABLE);

const TILES = [
  AIR,
  new Tile("#ccffcc", Kind.CONSUMABLE),
  new Tile("#999999", Kind.IMMOVABLE),
  new Tile("#ff0000", Kind.PLAYER),
  new Tile("#0000cc", Kind.PUSHABLE),
  new Tile("#8b4513", Kind.PUSHABLE),
  Tile.keyFor(LOCK1),
  LOCK1,
  Tile.keyFor(LOCK2),
  LOCK2,
];

const map = [
  [2, 2, 2, 2, 2, 2, 2, 2],
  [2, 3, 0, 1, 1, 2, 0, 2],
  [2, 4, 2, 5, 1, 2, 0, 2],
  [2, 6, 4, 1, 1, 2, 0, 2],
  [2, 4, 1, 1, 1, 7, 0, 2],
  [2, 2, 2, 2, 2, 2, 2, 2],
];

const board: Board = new Board(map, AIR, TILES);

const keybindings = new Keybindings();

keybindings.bindKeys(["ArrowUp", "w"], () => board.move(0, -1));
keybindings.bindKeys(["ArrowDown", "s"], () => board.move(0, 1));
keybindings.bindKeys(["ArrowLeft", "a"], () => board.move(-1, 0));
keybindings.bindKeys(["ArrowRight", "d"], () => board.move(1, 0));


function step() {
  if (board.settled) {
    keybindings.doActions();
  }
  board.dropTilesOneCell();
  board.draw(g);
}

function loop(step: () => void) {
  return () => {
    let start = Date.now();
    step();
    let spent = Date.now() - start;
    setTimeout(loop(step), Math.max(0, MILLIS_PER_FRAME - spent));
  };
}

window.onload = loop(step);
window.onkeydown = e => keybindings.handle(e);