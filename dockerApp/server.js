const rp = require('request-promise');
const R = require('ramda');
const Maybe = require('sanctuary-maybe');
const googleMapsClient = require('@google/maps').createClient({
  key: ''
});

const fixedPart = 'http://localhost:3000';

const postSomething = (body, path) => rp({
  method: 'POST',
  url: `${fixedPart}${path}`,
  body,
  json: true
});

const getSomething = path => rp({
  method: 'GET',
  url: `${fixedPart}${path}`,
  json: true
});

const updateTown = town => postSomething(town, '/updateV');

const resetTown = town => postSomething(town, '/resetV');

const updateHero = (town, hero) => postSomething({town, hero}, '/updateH');

const getTown = () => getSomething('/getV');

const getHero = () => getSomething('/getH');

// const deg2rad = deg => deg * (Math.PI / 180);

const callGoogleMaps = (heroTown, targetTown) => {
  return new Promise((resolve, reject) => {
    googleMapsClient.distanceMatrix({
      origins: heroTown,
      destinations: targetTown
    }).asPromise().then((response) => {resolve(response)})
  })
};

const getDistance = async (org, dest) => {
  return await callGoogleMaps(org, dest)
};

const findBestCity = R.curry(async (hero, v) => {
  const payload = await getDistance(hero.town, v.town);
  const distance = await R.path(
    ['json', 'rows', 0, 'elements', 0, 'distance', 'value'], payload);

  return await R.assoc('distance', distance, v);
});

const findBestRatio = (acc, v) => {
  console.log(R.prop('distance', v));
  const ratio = R.divide(R.prop('points', v), R.prop('distance', v) || 1);
  return R.ifElse(
    R.lte(R.prop('ratio', acc)),
    R.assoc('ratio', R.__, v),
    R.always(acc)
  )(ratio);
};

const processingHeroes = heroes => {

  const movingList = R.filter(R.pipe(R.prop('isMoving'), R.not), heroes);
  const bestHero = R.ifElse(
    R.isEmpty,
    R.always(Maybe.Nothing),
    R.nth(0)
  )(movingList);

  return bestHero;
};

const processingVillains = (cities, hero) => {

  console.log(`
    ${hero.name} : ${hero.score} pts 
    Calculating best route ... 
    `);

  const bestCity = R.pipe(
    R.map(findBestCity(hero)),
    R.reduce(findBestRatio, {ratio: -Infinity}),
  )(cities);

  console.log(`
    The selected town is ${bestCity.town}, 
    + ${bestCity.points} points for ${hero.name}
    `);
  return bestCity;
};

const aHeroIsFree = async selectedHero => {

  console.log(`Selected Hero is ${R.prop('name', selectedHero)}`);
  const cities = await getTown();
  console.log(cities);
  const bestCity = await processingVillains(cities, selectedHero);
  console.log(bestCity);

  await Promise.all([
    resetTown(bestCity),
    updateHero(bestCity, selectedHero)
  ]);
  await updateTown(selectedHero);
  console.log(`
  Travelling to ${bestCity.town} ...
  ___________________________________________
  `);
};

const checkStatus = (hero) => {
  R.ifElse(
    R.prop('eta', hero),  // inférieur a l'heure system
    updateHero(),
    R.always()
  )();
};

const broker = async (heroes) => {
  R.map(checkStatus, heroes);
};

const main = async () => {

  const heroes = await getHero();
  const selectedHero = await processingHeroes(heroes);

  R.ifElse(
    R.isEmpty,
    R.tap(() => console.log('Not Free')),
    aHeroIsFree
  )(selectedHero);

  await broker(heroes);
};

// setInterval(() => {
  main().then(() => {});
// }, 100);
