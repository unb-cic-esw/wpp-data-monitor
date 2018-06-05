# Whatsapp Data Monitor

## Ferramentas

- Selenium com ChromeDriver
  - Download do ChromeDriver (Linux64)
	  ```bash
		$ wget https://chromedriver.storage.googleapis.com/2.39/chromedriver_linux64.zip
		$ unzip chromedriver_linux64.zip
    $ rm chromedriver_linux64.zip
		```
- BeautifulSoup (requirements.txt)

## Instalação

```
$ virtualenv -p python3 venv
$ source venv/bin/activate
$ pip install -r requirements.txt
$ mkdir profile
```

Copiar seu cache do Chrome na pasta profile, e.g.:

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
