task :default do
  sh "pm2 start process.json"
end

task :stop do 
  sh "pm2 stop hasekura; pm2 delete hasekura"
  sh "pm2 stop Xvfb; pm2 delete Xvfb"
end

