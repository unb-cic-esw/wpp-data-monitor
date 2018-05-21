# Whatsapp Data Monitor

## Ferramentas

- Selenium
  - Instalar o geckodriver
	  ```bash
		$ wget https://github.com/mozilla/geckodriver/releases/download/v0.18.0/geckodriver-v0.18.0-linux64.tar.gz
		$ tar -xvzf geckodriver*
		$ chmod +x geckodriver
		$ sudo mv geckodriver /usr/local/bin/
		```
- BeautifulSoup (requirements.txt)

## Instalação

```
$ virtualenv -p python3 venv
$ source venv/bin/activate
$ pip install -r requirements.txt
$ mkdir profile
```

Copiar seu cache do firefox na pasta profile, e.g.:

```bash
$ cp $HOME/.mozilla/firefox/xgcc4j63.default/webappsstore* profile/
```

Obs.: O caminho do cache e o nome ``xgcc4j63`` antes do .default pode variar
então confira antes de realizar a cópia.

## Execução

- Testes
```
$ python test_selenium.py
```

- Arquivo que coleta última mensagem e reenvia
```
$ python main.py
```
