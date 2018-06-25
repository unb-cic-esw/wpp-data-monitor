## Ferramentas (Linux 64)

- Selenium com ChromeDriver

    ```bash
    $ wget https://chromedriver.storage.googleapis.com/2.39/chromedriver_linux64.zip
    $ unzip chromedriver_linux64.zip
    $ rm chromedriver_linux64.zip
    ```

- BeautifulSoup (requirements.txt)

## Instalação

```
$ python3 -m venv venv
$ source venv/bin/activate
$ pip install -r requirements.txt
$ mkdir profile
```

Copiar seu cache do Chrome na pasta profile, e.g.:

```bash
$ cp -r $HOME/.config/google-chrome/Default/ profile/
```

## Execução

- Testes
```
$ python -m unittest discover tests
```

- Software que monitora um grupo:
```
$ python main.py
```
