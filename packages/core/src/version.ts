/**
 * THE SIMULATION'S VERSION. A replay or a snapshot belongs to the engine that made it, not only to
 * its format: if the simulation keeps one more number, or reads its inputs another way, the same
 * inputs give another hash. So it goes up whenever the simulation changes what a replay or a
 * snapshot gives, and one of another version says so, instead of playing to a different world.
 *
 *   1  stage 1c: the first replays
 *   2  stage 1c2: turning (`ahead`, `side`, `turn`), the character's `turnSpeed`
 *   3  stage 1d: inputs as named values; the hash includes the id counter and the previous inputs
 *   4  stage 1e: who is in the match (`players`), in the hash and in snapshots
 *   5  stage 2a: zones (`sensor`) and a game's data on its entities (`game`)
 */
export const SIMULATION_VERSION = 5;
