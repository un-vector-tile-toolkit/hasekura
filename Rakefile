task :default do
  sh "pm2 stop hasekura; pm2 delete hasekura; pm2 start index.js -i 1 --name hasekura; pm2 monit"
end

task :stop do 
  sh "pm2 stop hasekura; pm2 delete hasekura"
end

