const gremlin = require('gremlin');
import User from './type/User';


const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;
const uri = process.env.WRITE_ADDRESS;


async function createUser(user: User) {
    let dc = new DriverRemoteConnection(`wss://${uri}/gremlin`, {});
    const graph = new Graph();
    const g = graph.traversal().withRemote(dc);

    try {
        await (
            //add specific data into database
            g.addV('users').property('name', user.name).next()
        );
        
        dc.close();
        return user;
    }
    catch(err) {
        console.log('ERROR', err);
        return null;
    }
}

export default createUser;