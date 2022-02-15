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

const Input = {
  UP: () => moveVertical(-1),
  DOWN: () => moveVertical(1),
  LEFT: () => moveHorizontal(-1),
  RIGHT: () => moveHorizontal(1),
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

type Thunk = () => void;

let inputs: Thunk[] = [];

class Cell {
  x: number;
  y: number;
  map: Tile[][];

  constructor(x: number, y: number, map: Tile[][]) {
    this.x = x;
    this.y = y;
    this.map = map;
  }

  dx(d: number): Cell {
    return new Cell(this.x + d, this.y, this.map);
  }

  dy(d: number): Cell {
    return new Cell(this.x, this.y + d, this.map);
  }

  below() { 
    return this.dy(1); 
  }

  tile() {
    return map[this.y][this.x];
  }

  is(tile: Tile) {
    return this.tile() === tile;
  }

  setTile(tile: Tile) {
    this.map[this.y][this.x] = tile;
  }

  clear() {
    this.setTile(Tile.AIR);
  }
}


let map: Tile[][] = [
  [2, 2, 2, 2, 2, 2, 2, 2],
  [2, 3, 0, 1, 1, 2, 0, 2],
  [2, 4, 2, 5, 1, 2, 0, 2],
  [2, 6, 4, 1, 1, 2, 0, 2],
  [2, 4, 1, 1, 1, 7, 0, 2],
  [2, 2, 2, 2, 2, 2, 2, 2],
];

let player = new Cell(1, 1, map);

function remove(tile: Tile) {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      let c = new Cell(x, y, map);
      if (c.is(tile)) c.clear();;
    }
  }
}

function movePlayerTo(c: Cell) {
  maybeUnlock(c.tile());
  moveTile(player, c);
  player = c;
}

function moveTile(from: Cell, to: Cell) {
  to.setTile(from.tile())
  from.clear();
}

function maybeUnlock(current: Tile) {
  if (locksAndKeys.has(current)) {
    remove(locksAndKeys.get(current));
  }
}

function moveHorizontal(dx: number) {
  const goingTo = player.dx(dx);
  const newTile = goingTo.tile();

  if (canBeOccupied.has(newTile)) {
    movePlayerTo(goingTo);
  } else if (canPush(goingTo, dx)) {
    moveTile(goingTo, goingTo.dx(dx));
    movePlayerTo(goingTo);
  }
}


function canPush(goingTo: Cell, dx: number): boolean {
  const newTile = goingTo.tile();
  const isPushable = newTile === Tile.STONE || newTile === Tile.BOX;
  const emptyAfter = goingTo.dx(dx).is(Tile.AIR);
  const emptyBelow = goingTo.below().is(Tile.AIR); // FIXME seems like this can't happen unless the block is floating already.

  return isPushable && emptyAfter && !emptyBelow;
}

function moveVertical(dy: number) {
  const goingTo = player.dy(dy);;
  if (canBeOccupied.has(goingTo.tile())) {
    movePlayerTo(goingTo);
  }
}

function update() {
  processInputs();
  dropTilesOneCell();
}

function processInputs() {
  while (inputs.length > 0) {
    inputs.pop()();
  }
}

function dropTilesOneCell() {
  for (let y = map.length - 2; y >= 0; y--) {
    for (let x = 0; x < map[y].length; x++) {
      let c = new Cell(x, y, map);
      let below = c.below();
      if (canFall(c.tile()) && below.is(Tile.AIR)) {
        moveTile(c, below);
      }
    }
  }
}

function canFall(tile: Tile) {
  return tile === Tile.STONE || tile === Tile.BOX;
}

function draw() {
  let canvas = document.getElementById("GameCanvas") as HTMLCanvasElement;
  let g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  drawMap(g);
}

function drawMap(g: CanvasRenderingContext2D) {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      let tile = new Cell(x, y, map).tile();
      if (tileColors.has(tile)) {
        g.fillStyle = tileColors.get(tile);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
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

