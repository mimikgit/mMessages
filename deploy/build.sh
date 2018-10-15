unameOut="$(uname -s)"
case "${unameOut}" in
    Linux*)     machine=Linux;;
    Darwin*)    machine=Mac;;
    MINGW*)     machine=MinGW;;
    *)          machine="UNKNOWN:${unameOut}"
esac

if [ ${machine} == "Mac" ] || [ ${machine} == "Linux" ]; then
  cp ../build/index.js ./
  sudo docker build -t messages-v1 .
  sudo docker save -o messages-v1.tar messages-v1
  sudo chmod 666 messages-v1.tar
  sudo docker rmi messages-v1       
elif [ ${machine} == "MinGW" ]; then
  cp ../build/index.js ./
  docker build -t messages-v1 .
  docker save -o messages-v1.tar messages-v1
  chmod 666 messages-v1.tar
  docker rmi messages-v1
fi

