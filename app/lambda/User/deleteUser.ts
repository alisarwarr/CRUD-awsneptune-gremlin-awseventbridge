const gremlin = require('gremlin');


const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;
const uri = process.env.WRITE_ADDRESS;


async function deleteUser(id: string) {
    let dc = new DriverRemoteConnection(`wss://${uri}/gremlin`, {});
    const graph = new Graph();
    const g = graph.traversal().withRemote(dc);

    try {
        await (
            //delete that specific id's data
            g.V().hasId(id).drop().iterate()
        );
        
        dc.close();
        return id;
    }
    catch(err) {
        console.log('ERROR', err);
        return null;
    }
}

export default deleteUser;
