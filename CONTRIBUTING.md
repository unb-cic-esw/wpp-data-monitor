## Ferramentas (Linux 64)

- Selenium com ChromeDriver

    ```bash
    $ wget https://chromedriver.storage.googleapis.com/2.39/chromedriver_linux64.zip
    $ unzip chromedriver_linux64.zip
    $ rm chromedriver_linux64.zip
    ```

- BeautifulSoup

## Instalação

```
$ python3 -m venv venv
$ source venv/bin/activate
$ pip install -e .
```

Logue no whatsapp no Google Chrome normalmente, feche o navegador e copie seu cache na pasta profile na pasta raiz do repositório, e.g.:

```bash
$ mkdir profile
$ cp -r $HOME/.config/google-chrome/Default/ profile/
```

## Execução

```
$ wpp
```

## Testes

```
$ python -m unittest discover tests
```


