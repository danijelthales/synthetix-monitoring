# sig-verifier
## installation
sudo su -  
curl -sL https://rpm.nodesource.com/setup_10.x | sudo bash -  
yum install nodejs  
npm i -g pm2  
cd sig-verifier/  
npm install  
pm2 start index.js


## setup autostart
as default user:  
crontab -e  
add line:  
@reboot sh -c 'cd sig-verifier && pm2 start index.js'
