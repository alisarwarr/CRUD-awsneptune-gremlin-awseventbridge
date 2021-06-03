import createUser from './createUser';
import deleteUser from './deleteUser';
import allUsers from './allUsers';

exports.handler = async(event) => {
    
    if (
        event["detail-type"] === "createUser"       //comes from HTTPdatasource as eventbridge
    ) {
        return await createUser(event.detail);
    }
    else if (
        event["detail-type"] === "deleteUser"       //comes from HTTPdatasource as eventbridge
    ) {
        return await deleteUser(event.detail.id);
    }
    else if (
        event.info.fieldName === "allUsers"         //comes from lambda as a datasource
    ) {
        return await allUsers();
    }

    return null;
}