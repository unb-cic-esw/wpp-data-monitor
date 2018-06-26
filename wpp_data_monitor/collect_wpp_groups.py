#
# from selenium.common.exceptions import TimeoutException


import time
import csv
import os

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

DEBUG = False

URLS = ['https://gruposdezap.com/',
        'https://linksdegrupos.com.br/',
        'http://www.buscagrupos.com.br/']

BAG_WORDS = ['Bolsonaro', 'eleições', 'eleição', 'boulos', 'marina',
            'marina silva', 'alckmin', 'lula', 'luiz inácio', 'manuela avila',
            'henrique meirelles', 'meirelles', 'ciro gomes', 'voto nulo',
            'voto', 'intervenção militar', 'intervenção', 'militar', 'direita',
            'esquerda', 'conservador', 'comunismo', 'capitalismo',
            'joão amoêdo', 'liberalismo']

driver_path = os.getcwd() + '/chromedriver'

if not DEBUG:
    chrome_options = Options()
    chrome_options.add_argument("--headless")

    # create the fake browser
    driver = webdriver.Chrome(driver_path, chrome_options=chrome_options)
else:
    driver = webdriver.Chrome(driver_path)


def wait_for_element(name):
    wait = WebDriverWait(driver, 10)
    return wait.until(EC.visibility_of_element_located((By.XPATH, name)))

def static_dir(path):
    return 'data/groups/'+path

def main():
    for word in BAG_WORDS:
        word_to_dir = static_dir(word.replace(' ', '_').lower())
        if not os.path.exists(word_to_dir):
            os.makedirs(word_to_dir)

        # get request using the fake browser
        driver.get('https://gruposdezap.com/')
        if DEBUG:
            xpath_popover = '//button[@id="onesignal-popover-cancel-button"]'
            wait_for_element(xpath_popover)
            popover = driver.find_element_by_xpath(xpath_popover)
            popover.click()
            time.sleep(1)

        xpath_search = '//input[@placeholder="Pesquisar"]'
        wait_for_element(xpath_search)
        search_input = driver.find_element_by_xpath(xpath_search)
        search_input.send_keys(word)

        xpath_search_icon = '//button[@id="searchsubmit"]'
        search_icon = driver.find_element_by_xpath(xpath_search_icon)
        search_icon.click()

        soup = BeautifulSoup(driver.page_source, "html.parser")
        all_groups = soup.findAll('a', text='PARTICIPAR')
        all_titles = [t.text.strip() for t in soup.findAll(
                                    'div', {'class': 'single-title-conteudo'})]
        link_wpp_group = []

        for link in all_groups:
            driver.get(link['href'])
            soup = BeautifulSoup(driver.page_source, "html.parser")
            link_wpp_group.append(soup.find('a', {'title': 'Entrar'})['href'])

        all_data = list(zip(all_titles, link_wpp_group))

        with open(word_to_dir+'/gruposdezap.csv', 'w') as outcsv:
            writer = csv.DictWriter(outcsv, fieldnames = ['group_title',
                                                            'link'])
            writer.writeheader()
            writer.writerows({'group_title': row[0],
                                'link': row[1]} for row in all_data)


if __name__ == '__main__':
    main()
