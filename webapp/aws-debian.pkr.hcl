packer {
  required_plugins {
    amazon = {
      version = ">=0.0.2"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "source_ami" {
  type    = string
  default = "ami-06db4d78cb1d3bbf9"
}

variable "ssh_username" {
  type    = string
  default = "admin"
}

variable "subnet_id" {
  type    = string
  default = "subnet-055a817d8a968f15f"
}

variable "ami_region" {
  type    = list(string)
  default = ["us-east-1"]
}

source "amazon-ebs" "debian" {
  region      = "${var.aws_region}"
  ami_name    = "csye6225_test_ami-${formatdate("YYYY-MM-DD-hhmmss", timestamp())}"
  ami_regions = "${var.ami_region}"
  ami_users   = ["338923190807"]

  aws_polling {
    delay_seconds = 120
    max_attempts  = 50
  }

  instance_type = "t2.micro"
  source_ami    = "${var.source_ami}"
  ssh_username  = "${var.ssh_username}"
  subnet_id     = "${var.subnet_id}"
  profile       = "developmentAccount"
}

build {
  sources = [
    "source.amazon-ebs.debian"
  ]

  provisioner "shell" {
    environment_vars = [
      "DEBIAN_FRONTEND=noninteractive",
      "CHECKPOINT_DISABLE=1"
    ]

    inline = [
      "sudo apt update",
      "sudo apt-get install unzip",
      "sudo apt install -y nodejs npm",
      // "sudo apt install -y mariadb-server",
      // "sudo systemctl enable mariadb",
      // "sudo systemctl start mariadb",
      // "echo -e '\\n\\N\\nY\\nprap@2602S\\nprap@2602S\\nN\\nN\\nN\\nY\\n' | sudo mysql_secure_installation",
      // "sudo mysql -u root -pprap@2602S -e 'CREATE DATABASE healthcare;'",
      // "sudo apt-get install -y expect",
      "wget https://s3.amazonaws.com/amazoncloudwatch-agent/debian/amd64/latest/amazon-cloudwatch-agent.deb",
      "sudo dpkg -i amazon-cloudwatch-agent.deb",
      "sudo apt-get install npm",
    ]
  }

  provisioner "file" {
    source      = "/home/runner/work/webapp/webapp/webapp.zip"
    destination = "~/"
  }

  provisioner "file" {
    source      = "cloudwatchAgentConfig.json"
    destination = "~/"
  }


  provisioner "file" {
    source      = "./systemd/cloud.service"
    destination = "/tmp/cloud.service"
  }

  provisioner "shell" {
    inline = [
      "echo webapp zip process",
      "sudo ls -al",
      "sudo mv /tmp/cloud.service /etc/systemd/system/cloud.service",
      "sudo unzip webapp.zip -d /opt/webapp",
      "sudo mv cloudwatchAgentConfig.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json",
      "sudo groupadd csye6225",
      "sudo useradd -s /bin/false -g csye6225 -d /opt/csye6225 -m csye6225",
      "sudo chown csye6225:csye6225 -R /opt/webapp",
      "cd /opt/webapp",
      "sudo npm install",
      "sudo npm install nodemon",
      "sudo chmod +x index.js",
      "sudo systemctl enable cloud",
      "sudo systemctl start cloud",
      "sudo systemctl restart cloud",
      "sudo systemctl stop cloud",
    ]
  }

  // provisioner "shell" {
  //   inline = [
  //     "echo web app zip process",
  //     "sudo ls -al",
  //     "unzip webapp.zip -d webapp",
  //     "sudo ls -al",
  //     "cd webapp",
  //     "npm install",
  //     "npm install nodemon",
  //   ]
  // }

  // provisioner "shell" {
  //   inline = [
  //     "echo make dir",
  //     "ls -al",
  //   ]
  // }

  // provisioner "shell" {
  //   inline = [
  //     "sudo apt-get purge -y git" 
  //   ]
  // }
}

