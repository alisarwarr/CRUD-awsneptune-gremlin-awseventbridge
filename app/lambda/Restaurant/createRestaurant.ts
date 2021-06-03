const gremlin = require('gremlin');
import Restaurant from './type/Restaurant';


const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;
const uri = process.env.WRITE_ADDRESS;


async function createRestaurant(restaurant: Restaurant) {
    let dc = new DriverRemoteConnection(`wss://${uri}/gremlin`, {});
    const graph = new Graph();
    const g = graph.traversal().withRemote(dc);

    try {
        await (
            //add specific data into database
            g.addV('restaurants').property('name', restaurant.name).property('address', restaurant.address).property('cuisine', restaurant.cuisine).next()
        );
        
        dc.close();
        return restaurant;
    }
    catch(err) {
        console.log('ERROR', err);
        return null;
    }
}

export default createRestaurant;