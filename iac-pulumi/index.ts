import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as gcp from "@pulumi/gcp";
import * as fs from "fs";

const config = new pulumi.Config();
const sourceEmail = config.require("sourceEmail");
const zoneId = config.require("zoneId")
const vpcName = config.require("vpcName");
const cidrBlock = config.require("cidrBlock");
const interGateway = config.require("interGateway");
const publicRouteT = config.require("publicRouteT");
const privateRouteT = config.require("privateRouteT");
const amiid = config.require("amiId")
const certificatearn = config.require("certificatearn");
const publicKeyGen = config.require("publickeygen");
const keyPairName = new aws.ec2.KeyPair("my-key-pair", {
    publicKey: publicKeyGen,

});
const dialect = config.require("dialect");
const port = config.require("port");

const region = aws.config.requireRegion();

//creating an array of public and private  subnets 

let publicSubnets: aws.ec2.Subnet[] = [];
let privateSubnets: aws.ec2.Subnet[] = [];

async function createNetwork() {
    // Creating a VPC
    const vpc = new aws.ec2.Vpc(vpcName, {
        cidrBlock: cidrBlock,
        tags: {
            Name: vpcName,
        },
    });

    // Step 2: Creating 3 public and private subnets
    const availabilityZones = await aws.getAvailabilityZones({});

    for (let i = 0; i < 3; i++) {
        const az = availabilityZones.names[i];
        const publicSubnet = new aws.ec2.Subnet(`public-subnet-${i}`, {
            vpcId: vpc.id,
            cidrBlock: `10.0.${i * 2}.0/24`,
            availabilityZone: az,
            mapPublicIpOnLaunch: true,
            tags: {
                Name: `publicSubnet-${i}`,
            },
        });

        publicSubnets.push(publicSubnet);

        const privateSubnet = new aws.ec2.Subnet(`private-subnet-${i}`, {
            vpcId: vpc.id,
            cidrBlock: `10.0.${i * 2 + 1}.0/24`,
            availabilityZone: az,
            tags: {
                Name: `privateSubnet-${i + 3}`,
            },
        });

        privateSubnets.push(privateSubnet);
    }

    // Step 3: Internet gateway to attach VPC
    const internetGateway = new aws.ec2.InternetGateway("internet-gateway", {
        vpcId: vpc.id,
        tags: {
            Name: interGateway,
        },
    });

    // Step 4: Public route associated with route table
    const publicRouteTable = new aws.ec2.RouteTable("public-route-table", {
        vpcId: vpc.id,
        tags: {
            Name: publicRouteT,
        },
    });

    publicSubnets.forEach((subnet, index) => {
        const route = new aws.ec2.Route(`public-route-${index}`, {
            routeTableId: publicRouteTable.id,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId: internetGateway.id,
        });

        new aws.ec2.RouteTableAssociation(`public-subnet-association-${index}`, {
            routeTableId: publicRouteTable.id,
            subnetId: subnet.id,
        });
    });

    // Step 5: Private route associated with route table
    const privateRouteTable = new aws.ec2.RouteTable("private-route-table", {
        vpcId: vpc.id,
        tags: {
            Name: privateRouteT,
        },
    });

    privateSubnets.forEach((subnet, index) => {
        new aws.ec2.RouteTableAssociation(`private-subnet-association-${index}`, {
            routeTableId: privateRouteTable.id,
            subnetId: subnet.id,
        });
    });

    return vpc.id;
}

async function main() {
    const vpcId = await createNetwork();

    //Creating security group for load balancer allowing only 80 and 443 port and connected to the vpc. 
    const lbSecurityGroup = new aws.ec2.SecurityGroup("Load Balancer", {
        name: "Load Balancer",
        description: "Security group for load balancer",
        ingress: [
            {
                protocol: "tcp",
                fromPort: 80,
                toPort: 80,
                cidrBlocks: ["0.0.0.0/0"],
            },
            {
                protocol: "tcp",
                fromPort: 443,
                toPort: 443,
                cidrBlocks: ["0.0.0.0/0"],
            },
        ],
        egress: [
            {
                fromPort: 0,
                toPort: 0,
                protocol: "-1",
                cidrBlocks: ["0.0.0.0/0"],
            },
        ],
        vpcId: publicSubnets[0].vpcId
    });

    // Creating a security group for your EC2 instances.
    const appSecurityGroup = new aws.ec2.SecurityGroup("applicationSecurityGroup", {
        name: "WebappSecurityGroup",
        description: "Security group for web applications",
        ingress: [
            {
                fromPort: 22,
                toPort: 22,
                protocol: "tcp",
                cidrBlocks: ["0.0.0.0/0"],
            },
            {
                fromPort: 8080,
                toPort: 8080,
                protocol: "tcp",
                securityGroups: [lbSecurityGroup.id],
            },
        ],
        egress: [
            {
                fromPort: 0,
                toPort: 0,
                protocol: "-1",
                cidrBlocks: ["0.0.0.0/0"]
            },
        ],
        vpcId: publicSubnets[0].vpcId, //associating security group with an VPC 
    });

    //security group for RDS.
    const rdsSecurityGroup = new aws.ec2.SecurityGroup("databaseSecurityGroup", {
        name: "databaseSecruityGroup",
        description: "Security group for web applications",
        ingress: [
            {
                fromPort: 3306,
                toPort: 3306,
                protocol: "tcp",
                securityGroups: [appSecurityGroup.id],
            },

        ],
        vpcId: publicSubnets[0].vpcId,
    });

    //Created a parameter group for my db connecting to mysql verison of 8
    const rdsParameterGroup = new aws.rds.ParameterGroup("rdsParameterGroup", {
        name: "my-rds-parameter-group",
        family: "mysql8.0",
        description: "Creates a parameter group for MySQL 8.0.34",
        parameters: [
            {
                name: "max_connections",
                value: "100",
                applyMethod: "pending-reboot",
            },
        ],
    });

    // Created an RDS Subnet Group using privateSubnets
    const rdsSubnetGroup = new aws.rds.SubnetGroup("rds-subnet-group", {
        name: "my-rds-subnet-group",
        description: "My RDS Subnet Group",
        subnetIds: privateSubnets.map(subnet => subnet.id),
    });

    const rdsInstance = new aws.rds.Instance("rds-instance", {  //Created an rds instance for the mysql database
        allocatedStorage: 20,
        storageType: "gp2",
        engine: "mysql",
        engineVersion: "8.0.34",
        instanceClass: "db.t3.micro",
        username: "root",
        password: "prap2602S",
        skipFinalSnapshot: true,
        multiAz: false,
        publiclyAccessible: false,
        dbName: "healthcare",
        vpcSecurityGroupIds: [rdsSecurityGroup.id],
        parameterGroupName: rdsParameterGroup.name,
        dbSubnetGroupName: rdsSubnetGroup.name,
    });

    // Create an IAM role with the CloudWatchAgentServerPolicy
    const ec2Role = new aws.iam.Role("WebAppEC2Role", {
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Principal: {
                    Service: "ec2.amazonaws.com",
                },
                Action: "sts:AssumeRole",
            }],
        }),
    });

    // Attach the CloudWatchAgentServerPolicy to the IAM role
    const cloudWatchAgentServerPolicy = new aws.iam.PolicyAttachment("CloudWatchAgentServerPolicy", {
        policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
        roles: [ec2Role.name],
    });

    // Attach the CloudWatchAgentServerPolicy to the IAM role
    const snsPolicy = new aws.iam.PolicyAttachment("PolicyForServerless", {
        policyArn: "arn:aws:iam::aws:policy/AmazonSNSFullAccess",
        roles: [ec2Role.name],
    });




    // Create an instance profile and associate the IAM role
    const ec2InstanceProfile = new aws.iam.InstanceProfile("ec2InstanceProfile", {
        role: ec2Role.name,
    });

    
    const snsTopic = new aws.sns.Topic("awssns",{
        displayName: "SNS for submission",
    });

    //Launch template for EC2 instance. 
    const launchTemplateForec2 = new aws.ec2.LaunchTemplate("WebappTemplate", {
        imageId: amiid,
        // vpcSecurityGroupIds: [appSecurityGroup.id], 
        instanceType: "t2.micro",
        keyName: keyPairName.keyName,
        networkInterfaces: [
            {
                associatePublicIpAddress: pulumi.output(true).apply(String),
                securityGroups: [appSecurityGroup.id],
            },
        ],
        userData: pulumi.interpolate`#!/bin/bash
        sudo systemctl enable amazon-cloudwatch-agent.service
        sudo systemctl start amazon-cloudwatch-agent.service

        sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
        -a fetch-config \
        -m ec2 \
        -c file:/opt/cloudwatchAgentConfig.json \
        -s
        cat << EOF > /opt/webapp/app/config/configureDB.js
    module.exports = {
            HOST: "${rdsInstance.address}",
            PORT: "${port}",
            DB: "${rdsInstance.dbName}",
            USER: "${rdsInstance.username}",
            PASSWORD: "${rdsInstance.password}",
            dialect: "${dialect}",
            TOPIC_ARN: "${snsTopic.arn}"
    }`.apply(s => Buffer.from(s).toString('base64')), //converting to base64. 

        iamInstanceProfile: {name: ec2InstanceProfile.name}, //adding role
    });

    //Creating a target group, for port 8080. 

    const targetGroup = new aws.lb.TargetGroup("webAppTargetGroup", {
        port: 8080,
        protocol: "HTTP",
        targetType: "instance",
        vpcId: publicSubnets[0].vpcId,
        healthCheck: {
            enabled: true,
            path: "/healthz",
            port: "8080",
            protocol: "HTTP",
            timeout: 5,
            interval: 30,
            unhealthyThreshold: 2,
            healthyThreshold: 2,
        },
    });

    //autoscaling group mapping each public subnet ip, working on the target group.
    const autoScalingGroup = new aws.autoscaling.Group("webAppAutoScalingGroup", {
        minSize: 1,
        maxSize: 3,
        desiredCapacity: 1,
        launchTemplate: {
            "id": launchTemplateForec2.id,
            "version": "$Latest"
        },
        vpcZoneIdentifiers: publicSubnets.map((subnet) => subnet.id),
        tags: [
            {
            key: "Name",
            value: "MyAutoScalingInstance",
            propagateAtLaunch: true,
            }
    ],
        healthCheckType: "EC2",
        healthCheckGracePeriod: 300,
        forceDelete: true,
        terminationPolicies: ["OldestInstance"],
        targetGroupArns: [targetGroup.arn],
    });

    //scaleuppolicy: cooldown is 120 
    const scaleUpPolicy = new aws.autoscaling.Policy("scaleup", {
        scalingAdjustment: 1,
        adjustmentType: "ChangeInCapacity",
        cooldown: 120,
        autoscalingGroupName: autoScalingGroup.name,
    });

    //when CPU load is high. Actions to perform is scaleup policy. 
    const cpuHigh = new aws.cloudwatch.MetricAlarm("cpuHigh", {
        comparisonOperator: "GreaterThanThreshold",
        evaluationPeriods: 1,
        metricName: "CPUUtilization",
        namespace: "AWS/EC2",
        period: 300,
        threshold: 5,
        statistic: "Average",
        dimensions: { AutoScalingGroupName: autoScalingGroup.name },
        alarmActions: [scaleUpPolicy.arn],
    });

     //scaleuppolicy: cooldown is 120
    const scaleDownPolicy = new aws.autoscaling.Policy("scaleDownPolicy", {
        scalingAdjustment: -1,
        adjustmentType: "ChangeInCapacity",
        cooldown: 120,
        autoscalingGroupName: autoScalingGroup.name
    });

    //when CPU load is low. Actions to perform is scaledown policy. 
    const cpuLow = new aws.cloudwatch.MetricAlarm("cpuLow", {
        comparisonOperator: "LessThanThreshold",
        evaluationPeriods: 1,
        metricName: "CPUUtilization",
        namespace: "AWS/EC2",
        period: 300, // 5 minutes
        threshold: 3,
        statistic: "Average",
        dimensions: { AutoScalingGroupName: autoScalingGroup.name },
        alarmActions: [scaleDownPolicy.arn],
    });



    // Setup Application Load Balancer
    const loadBalancerwebapp = new aws.lb.LoadBalancer("webAppLoadBalancer", {
        internal: false,
        loadBalancerType: "application",
        securityGroups: [lbSecurityGroup.id],
        subnets: publicSubnets.map(subnet => subnet.id),
        enableDeletionProtection: false
    });

    const SSLCertificate = new aws.acm.Certificate("sslCertificate", {
        domainName: "demo.aditij.me", 
        validationMethod: "DNS",
    });

    //adding listener which listens to port 80
    const listener = new aws.lb.Listener("webAppListener", {
        loadBalancerArn: loadBalancerwebapp.arn,
        port: 443,
        protocol:"HTTPS",
        // defaultActions: [
        //     {
        //         type: "forward",
        //         targetGroupArn: targetGroup.arn,
        //         fixedResponse: {
        //             contentType: "text/plain",
        //             messageBody: "Hello, world!",
        //             statusCode: "200",
        //         },
        //     },
        // ],
        certificateArn: certificatearn,
        defaultActions: [
            {
                type: "forward",
                targetGroupArn: targetGroup.arn
            }
        ]
    });

    // const targetGroupAttachment = new aws.lb.TargetGroupAttachment("webAppTargetAttachment", {
    //     targetGroupArn: targetGroup.arn,
    //     targetId: autoScalingGroup.id,
    // });

    const domainName = "demo.aditij.me";
    const recordName = "aditij";
    // const recordTTL = 60;

    // Create an A record in Route53 to point to the EC2 instance's public IP
    const dnsARecord = new aws.route53.Record(recordName, {
        zoneId: zoneId,
        name: domainName,
        type: "A",
        // ttl: recordTTL,
        aliases: [{
            name: loadBalancerwebapp.dnsName,
            zoneId: loadBalancerwebapp.zoneId,
            evaluateTargetHealth: true, 
        }]
    });

    


    const serverlessPath = "C:/Users/Admin/Documents/MSIS/Cloud/Assignment9_serverless/serverless";

    //creating role for lambda. 
    const lambdarole = new aws.iam.Role("RoleForLambda", {
        assumeRolePolicy: pulumi.output({
            Version: "2012-10-17",
            Statement: [{
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Principal: {
                    Service: "lambda.amazonaws.com",
                },
            }],
        }).apply(JSON.stringify),
    });

    //Creating policy for dynamoDB.
    const dynamoDBTablePolicy = new aws.iam.Policy("dynamoEmail", {
        description: "policy for dynamoDB.",
        policy: pulumi.output({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: [
                        "dynamodb:GetItem",
                        "dynamodb:PutItem",
                        "dynamodb:UpdateItem",
                        "dynamodb:Query",
                        "dynamodb:Scan",
                        "dynamodb:BatchWriteItem",
                        "dynamodb:BatchGetItem",
                    ],
                    Resource: [
                            "*"
                    ],
                },
            ],
        }),
    });

        //Attaching the policy to a role
    const lambdaDynamoDBAttachment = new aws.iam.RolePolicyAttachment("lambdaDynamoDBAttachment", {
        policyArn: dynamoDBTablePolicy.arn,
        role: lambdarole.name,
    });


//
    const emailTracking = new aws.dynamodb.Table("Tracking", {
        attributes: [
            { name: "EmailId", type: "S" },
            { name: "Timestamp", type: "S" },
            { name: "Status", type: "S" },
        ],
        billingMode: "PAY_PER_REQUEST", 
        hashKey: "EmailId", 
        rangeKey: "Timestamp",
        globalSecondaryIndexes: [
            {
                name: "TimestampIndex",
                hashKey: "Timestamp",
                projectionType: "ALL",
            },
            {
                name: "StatusIndex",
                hashKey: "Status",
                projectionType: "ALL",
            },
        ],
      });

    const lambdaPolicy = new aws.iam.RolePolicyAttachment("PolicyForLambda", {
        policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        role: lambdarole.name,
    });


    //GCP SETUP
    const gcpbucket = new gcp.storage.Bucket("aditi-bucket-2612",{
        name: "aditi-bucket-2612",
        location: "us-east1",
        forceDestroy: true,
        project: "democsye6225-406421",
    });

    const serviceAccount = new gcp.serviceaccount.Account("my-service-account", {
        accountId: "my-service-account",
        displayName: "My Service Account",
        project: "democsye6225-406421",
    });

    const serviceAccountKey = new gcp.serviceaccount.Key("my-service-account-key", {
        serviceAccountId: serviceAccount.accountId,
        publicKeyType: "TYPE_X509_PEM_FILE",
    });

    const bucketIAMBinding = new gcp.storage.BucketIAMBinding("bucketIAMBinding", {
        bucket: gcpbucket.name,
        members: [serviceAccount.email.apply((e)=>`serviceAccount:${e}`)],
        role: "roles/storage.objectCreator",
    });

    //Creating a lamdba fucntion used to track emails and send it

    let lambdaFunction = new aws.lambda.Function("FunctionForLambda", {
        runtime: aws.lambda.Runtime.NodeJS14dX,
        handler: "index.handler",
        // code: lambdaCode,
        code: new pulumi.asset.AssetArchive({
            ".":new pulumi.asset.FileArchive(serverlessPath)}),
        description: "A simple Hello, Pulumi! Lambda function",
        memorySize: 128,
        role: lambdarole.arn,
        environment:{
            variables: {
                gcpBucketName: "aditi-bucket-2612",
                gcpProjId: serviceAccount.project,
                gcpEmail: serviceAccount.email,
                gcpPrivateKey: serviceAccountKey.privateKey,
                sourceEmail: sourceEmail,
                dynamoTable: emailTracking.name,
            }
        }
    });

    //SNS creation

    const sns = new aws.sns.TopicSubscription("snsSubscription", {
        topic: snsTopic.arn,
        protocol: "lambda",
        endpoint: lambdaFunction.arn,
    });

    const permission = new aws.lambda.Permission("PermissionForLambda", {
        action: "lambda:InvokeFunction",
        function: lambdaFunction.name,
        principal: "sns.amazonaws.com",
        sourceArn: snsTopic.arn,
    });
    


    // // Created an EC2 instance with an user data which changes the configuration of our database.
    // const ec2Instance = new aws.ec2.Instance("webAppInstance", {
    //     ami: amiid,
    //     instanceType: "t2.micro",
    //     vpcSecurityGroupIds: [appSecurityGroup.id],
    //     subnetId: publicSubnets[0].id, // Using one of the public subnets.
    //     keyName: keyPairName.keyName,
    //     iamInstanceProfile: ec2InstanceProfile.name,
    //     // iamInstanceProfile: ec2InstanceProfile.name,
    //     userData: pulumi.interpolate`#!/bin/bash
    //     sudo systemctl enable amazon-cloudwatch-agent.service
    //     sudo systemctl start amazon-cloudwatch-agent.service

    //     sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    //     -a fetch-config \
    //     -m ec2 \
    //     -c file:/opt/cloudwatchAgentConfig.json \
    //     -s
    //     cat << EOF > /opt/webapp/app/config/configureDB.js
    // module.exports = {
    //         HOST: "${rdsInstance.address}",
    //         PORT: "${port}",
    //         DB: "${rdsInstance.dbName}",
    //         USER: "${rdsInstance.username}",
    //         PASSWORD: "${rdsInstance.password}",
    //         dialect: "${dialect}",
    // }`,
    //     tags: {
    //         Name: "WebAppInstance",
    //     }, rootBlockDevice: {

    //         volumeSize: 25,

    //         volumeType: 'gp2',

    //         deleteOnTermination: true,

    //     },
    // });

        // const domainName = "aditij.me"; 
        // const recordName = "aditij"; 
        // const recordTTL = 300; 

        // // Create an A record in Route53 to point to the EC2 instance's public IP
        // const dnsARecord = new aws.route53.Record(recordName, {
        //     zoneId: "Z005655117O26S6K515N",
        //     name: domainName,
        //     type: "A",
        //     ttl: recordTTL,
        //     records: [ec2Instance.publicIp],
        // });
}

main();

