/**
 * Bush — a sleeping enemy identical in behaviour to the Rock (rockenemy.js),
 * just a different skin. It sits inert as a scruffy bush, wakes when the player
 * bumps it (wake-up animation in its current orientation), then chases and
 * shoves; loses interest and dozes back off when the player gets away.
 *
 * All the logic lives in RockEnemy; a Bush is that class pointed at the bush
 * sprite pack. Only `_packConfig` changes.
 */
class BushEnemy extends RockEnemy {
    _packConfig() {
        return { sheetKey: 'bush_sheet', jsonKey: 'bush_sprites', cacheKey: '_enemyBushPack' };
    }
}

// Scatter sleeping bushes near the player spawn, same as the rocks.
function spawnBushEnemies(game, world, cfg) {
    return spawnSleeperEnemies(game, world, cfg, BushEnemy);
}

window.BushEnemy = BushEnemy;
window.spawnBushEnemies = spawnBushEnemies;
