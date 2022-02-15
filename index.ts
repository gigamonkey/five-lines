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
  KEY1, LOCK1,
  KEY2, LOCK2
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

class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  dx(d: number): Point {
    return new Point(this.x + d, this.y);
  }

  dy(d: number): Point {
    return new Point(this.x, this.y + d);
  }
}

let player = new Point(1, 1);

let map: Tile[][] = [
  [2, 2, 2, 2, 2, 2, 2, 2],
  [2, 3, 0, 1, 1, 2, 0, 2],
  [2, 4, 2, 5, 1, 2, 0, 2],
  [2, 6, 4, 1, 1, 2, 0, 2],
  [2, 4, 1, 1, 1, 7, 0, 2],
  [2, 2, 2, 2, 2, 2, 2, 2],
];



function remove(tile: Tile) {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === tile) {
        map[y][x] = Tile.AIR;
      }
    }
  }
}

function movePlayerTo(p: Point) {
  removeLocks(map[p.y][p.x]);
  moveTile(player, p);
  player = p;
}

function moveTile(from: Point, to: Point) {
  map[to.y][to.x] = map[from.y][from.x];
  map[from.y][from.x] = Tile.AIR;
}

function removeLocks(current: Tile) {
  if (locksAndKeys.has(current)) {
    remove(locksAndKeys.get(current));
  }
}

function moveHorizontal(dx: number) {
  const goingTo = player.dx(dx);
  const newTile = map[goingTo.y][goingTo.x];

  if (canBeOccupied.has(newTile)) {
    movePlayerTo(goingTo);
  } else if (canPush(goingTo, dx)) {
    moveTile(goingTo, goingTo.dx(dx));
    movePlayerTo(goingTo);
  }
}


function canPush(goingTo: Point, dx: number): boolean {
  const newTile = map[goingTo.y][goingTo.x];
  const isPushable = newTile === Tile.STONE || newTile === Tile.BOX;
  const emptyAfter = map[goingTo.y][goingTo.x + dx] === Tile.AIR;
  const emptyBelow = map[goingTo.y + 1][goingTo.x] === Tile.AIR; // FIXME seems like this can't happen unless the block is floating already.

  return isPushable && emptyAfter && !emptyBelow;
}

function moveVertical(dy: number) {
  const goingTo = player.dy(dy);;
  if (canBeOccupied.has(map[goingTo.y][goingTo.x])) {
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
      let tile = map[y][x];
      if (canFall(tile) && map[y + 1][x] === Tile.AIR) {
        let p = new Point(x, y);
        moveTile(p, p.dy(1));
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
      let tile = map[y][x];
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

