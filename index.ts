type Action = () => void;
type CellPredicate = (c: Cell) => boolean;

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

const consumable = new Set<Tile>([Tile.AIR, Tile.FLUX, Tile.KEY1, Tile.KEY2]);

const locksAndKeys: Map<Tile, Tile> = new Map<Tile, Tile>([
  [Tile.KEY1, Tile.LOCK1],
  [Tile.KEY2, Tile.LOCK2],
]);

const tileColors = new Map<Tile, string>([
  [Tile.AIR, "#ffffff"],
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

class Cell {
  x: number;
  y: number;
  tiles: Tile[][];

  constructor(x: number, y: number, map: Tile[][]) {
    this.x = x;
    this.y = y;
    this.tiles = map;
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = tileColors.get(this.tile());
    g.fillRect(this.x * TILE_SIZE, this.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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

  isEmpty() {
    return this.is(Tile.AIR);
  }

  setTile(tile: Tile) {
    this.tiles[this.y][this.x] = tile;
  }

  clear() {
    this.setTile(Tile.AIR);
  }

  moveTile(to: Cell) {
    to.setTile(this.tile())
    this.clear();
  }

  canBeConsumed() {
    return consumable.has(this.tile());
  }

  canFall() {
    return this.is(Tile.STONE) || this.is(Tile.BOX);
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

class Board {
  tiles: Tile[][];
  player: Cell;

  constructor(tiles: Tile[][]) {
    this.tiles = tiles;
    let players = this.cells(c => c.is(Tile.PLAYER));
    this.player = players.next().value;
    console.assert(players.next().done, "Only one player");
  }

  draw(g: CanvasRenderingContext2D) {
    for (let c of this.cells(() => true)) {
      c.draw(g);
    }
  }

  move(dx: number, dy: number) {
    const goingTo = this.player.dx(dx).dy(dy);
    if (goingTo.canBeConsumed()) {
      this.movePlayerTo(goingTo);
    } else if (dx !== 0 && goingTo.canBePushed(dx)) {
      goingTo.moveTile(goingTo.dx(dx));
      this.movePlayerTo(goingTo);
    }
  }

  movePlayerTo(c: Cell) {
    this.maybeUnlock(c.tile());
    this.player.moveTile(c);
    this.player = c;
  }

  maybeUnlock(current: Tile) {
    if (locksAndKeys.has(current)) {
      this.remove(locksAndKeys.get(current));
    }
  }

  dropTilesOneCell() {
    for (let c of this.cells(c => c.canFall())) {
      if (c.y < this.tiles.length - 1) {
        let below = c.below();
        if (below.isEmpty()) {
          c.moveTile(below);
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
        if (p(cell)) yield cell;
      }
    }
  }
}

class Keybindings {
  bindings: Map<string, Action>;
  actions: Action[];

  constructor() {
    this.bindings = new Map<string, Action>();
    this.actions = [];
  }

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

let board: Board = new Board([
  [2, 2, 2, 2, 2, 2, 2, 2],
  [2, 3, 0, 1, 1, 2, 0, 2],
  [2, 4, 2, 5, 1, 2, 0, 2],
  [2, 6, 4, 1, 1, 2, 0, 2],
  [2, 4, 1, 1, 1, 7, 0, 2],
  [2, 2, 2, 2, 2, 2, 2, 2],
]);

const keybindings = new Keybindings();

keybindings.bindKeys(["ArrowUp", "w"], () => board.move(0, -1));
keybindings.bindKeys(["ArrowDown", "s"], () => board.move(0, 1));
keybindings.bindKeys(["ArrowLeft", "a"], () => board.move(-1, 0));
keybindings.bindKeys(["ArrowRight", "d"], () => board.move(1, 0));


function step() {
  keybindings.doActions();
  board.dropTilesOneCell();
  g.clearRect(0, 0, canvas.width, canvas.height);
  board.draw(g);
}

function loop(step: () => void) {
  return () => {
    let start = Date.now();
    step();
    setTimeout(loop(step), Math.max(0, (start + MILLIS_PER_FRAME) - Date.now()));
  }
}

window.onload = loop(step);
window.onkeydown = e => keybindings.handle(e);