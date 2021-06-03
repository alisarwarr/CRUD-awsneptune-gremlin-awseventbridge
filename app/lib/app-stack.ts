import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as lambda from '@aws-cdk/aws-lambda';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as neptune from '@aws-cdk/aws-neptune';
//EVENTBRIDGE
import * as events from '@aws-cdk/aws-events';
import * as targets from '@aws-cdk/aws-events-targets';
//VTL-REQUEST-RESPONSE
import { EVENT_SOURCE, requestTemplate, responseTemplate } from '../utils/appsync-request-response';


export class AppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);




    //APPSYNC's API gives you a graphqlApi with apiKey ( for deploying APPSYNC )
    const api = new appsync.GraphqlApi(this, 'graphlApi', {
      name: 'dinningbyfriends-api',
      schema: appsync.Schema.fromAsset('graphql/schema.gql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY
        }
      }
    });




    //creating HTTPdatasource ( that will put our event to the eventbus )
    const http_datasource = api.addHttpDataSource('dinningbyfriends-ds',
      //ENDPOINT for eventbridge
      `https://events.${this.region}.amazonaws.com/`,
      {
        name: 'httpDsWithEventBridge',
        description: 'From Appsync to Eventbridge',
        authorizationConfig: {
          signingRegion: this.region,
          signingServiceName: 'events'
        }
      }
    );
    //giving permissions for HTTPdatasource
    events.EventBus.grantPutEvents(http_datasource);




    //mutations
    const mutations = ["createUser", "deleteUser", "createRestaurant", "deleteRestaurant"];
    mutations.forEach((thatMutation: string) => {
      let details = `\\\"id\\\": \\\"$ctx.args.id\\\"`;

      if(thatMutation === "createUser") {
        details = `\\\"id\\\":\\\"$ctx.args.id\\\", \\\"name\\\":\\\"$ctx.args.name\\\"`;
      }
      else if(thatMutation === "createRestaurant") {
        details = `\\\"id\\\":\\\"$ctx.args.id\\\", \\\"name\\\":\\\"$ctx.args.name\\\", \\\"address\\\":\\\"$ctx.args.address\\\", \\\"cuisine\\\":\\\"$ctx.args.cuisine\\\"`;
      }
      
      //describing resolver for datasource ( for send data to NEPTUNE )
      http_datasource.createResolver({
        typeName: "Mutation",
        fieldName: thatMutation,
        requestMappingTemplate: appsync.MappingTemplate.fromString(requestTemplate(details, thatMutation)),
        responseMappingTemplate: appsync.MappingTemplate.fromString(responseTemplate())
      });
    });




    //creating VirtualPrivateCloud
    const vpc = new ec2.Vpc(this, 'dinningbyfriends-vpc');




    //creating lambdalayer
    const lambdaLayer = new lambda.LayerVersion(this, 'lambdaLayer', {
      code: lambda.Code.fromAsset('lambda-layers'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X]
    });
    //creating lambdafunction
    const userLambda = new lambda.Function(this, 'dinningbyfriends-userLambda', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: new lambda.AssetCode("lambda/User"),
      handler: 'index.handler',
      //giving layers
      layers: [lambdaLayer],
      //giving VPC
      vpc: vpc
    });
    const restaurantLambda = new lambda.Function(this, 'dinningbyfriends-restaurantLambda', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: new lambda.AssetCode("lambda/Restaurant"),
      handler: 'index.handler',
      //giving layers
      layers: [lambdaLayer],
      //giving VPC
      vpc: vpc
    });




    //setting lambdafunction ( as a datasource of endpoint )
    const userLambda_datasource = api.addLambdaDataSource('userLamdaDataSource', userLambda);
    const restaurantLambda_datasource = api.addLambdaDataSource('restaurantLamdaDataSource', restaurantLambda);




    //describing resolver for datasource
    userLambda_datasource.createResolver({
      typeName: "Query",
      fieldName: "allUsers"
    });
    //describing resolver for datasource
    restaurantLambda_datasource.createResolver({
      typeName: "Query",
      fieldName: "allRestaurants"
    });




//**************************NEPTUNE**************************/
    //creating NEPTUNE database cluster
    const cluster = new neptune.DatabaseCluster(this, 'dinningbyfriends-database', {
      vpc: vpc,
      instanceType: neptune.InstanceType.R5_LARGE
    });


    //to control who can access the cluster
    //( any conection in this VPC can access NEPTUNE database cluster, so lambdafunction in VPC can use it )
    cluster.connections.allowDefaultPortFromAnyIpv4('Open to the world');
  

    //endpoints for write access NEPTUNE database cluster 
    const writeAddress = cluster.clusterEndpoint.socketAddress;
    //endpoints for read access NEPTUNE database cluster 
    const readAddress = cluster.clusterReadEndpoint.socketAddress;
//**************************NEPTUNE**************************/




    //adding env to lambdafunction
    userLambda.addEnvironment('WRITE_ADDRESS', writeAddress);
    userLambda.addEnvironment('READ_ADDRESS', readAddress);
    //adding env to lambdafunction
    restaurantLambda.addEnvironment('WRITE_ADDRESS', writeAddress);
    restaurantLambda.addEnvironment('READ_ADDRESS', readAddress);




    //rule fire by default event bus has target our lambdas
    const rule = new events.Rule(this, 'appsyncEventbridgeRule', {
      ruleName: 'dinningbyfriends-appsyncEventbridgeRule',
      description: 'created for appSyncEventbridge',
      eventPattern: {
        source: [EVENT_SOURCE],
        detailType: [...mutations]
        //every event that has source = "dinningbyfriends-events" will be sent to our lambdas
      },
      targets: [new targets.LambdaFunction(userLambda), new targets.LambdaFunction(restaurantLambda)]
    });
  }
}