from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By

from selenium import webdriver
from bs4 import BeautifulSoup
from datetime import datetime
import time
import csv
import os


class EngineWpp:
    def __init__(self):
        # default group name to test
        self.group_name = 'GRUPO RESOCIE'

        # chromedriver binary
        driver_path = os.getcwd() + '/chromedriver'
        profile_path = os.getcwd() + '/profile/'

        chrome_options = webdriver.ChromeOptions()
        # chrome_options.add_argument('--headless')
        chrome_options.add_argument(f'--user-data-dir={profile_path}')

        # create the fake browser
        self.driver = webdriver.Chrome(driver_path, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 20)

        # get request using the fake browser
        self.driver.get('https://web.whatsapp.com/')
        xpath_home = "//*[contains(text(), 'Mantenha seu telefone conectado')]"
        self.wait_for_element(xpath_home)

        self.last_row = None
        self.static_dir = os.getcwd() + '/data/messages'

    def wait_for_element(self, name):
        return self.wait.until(EC.visibility_of_element_located((By.XPATH, name)))

    def click_group(self, group_name):
        self.group_name = group_name
        xpath_group = f'//*[@title="{group_name}"]'
        self.wait_for_element(xpath_group)

        group = self.driver.find_element_by_xpath(xpath_group)
        group.click()

    def send_message_to_group(self, message):
        xpath_input_group = "//div[@contenteditable='true']"
        input_group = self.driver.find_element_by_xpath(xpath_input_group)
        input_group.send_keys(message)

        xpath_send_group = "//span[@data-icon='send']"
        send_group = self.driver.find_element_by_xpath(xpath_send_group)
        send_group.click()

    def get_last_messages(self, soup):
        return soup.findAll('span',
                    {'class': 'selectable-text invisible-space copyable-text'})

    def get_info_from_row(self, soup):
        if self.last_row:
            self.last_row = self.last_row.find_next('span',
                    {'class': 'selectable-text invisible-space copyable-text'})
        else:
            self.last_row = soup.find('span',
                    {'class': 'selectable-text invisible-space copyable-text'})

        message = self.last_row.text
        user_info = self.last_row.parent.parent['data-pre-plain-text']
        datetime = user_info[1:user_info.find(']')]
        user = user_info[user_info.find(']')+2:-1]

        return user, datetime, message

    def get_message_from_group(self):
        html = self.driver.page_source
        soup = BeautifulSoup(html, 'html.parser')
        package_messages = []

        texts = self.get_last_messages(soup)
        package_messages.append(self.get_info_from_row(soup))

        for _ in range(len(texts)-1):
            package_messages.append(self.get_info_from_row(soup))

        return package_messages

    def record_messages(self, package_messages):
        now_dt = datetime.now().strftime("%d-%m-%Y")
        filename = f'{now_dt}.csv'
        group_name = self.group_name.replace(' ', '_')
        file_path = f'{self.static_dir}/{group_name}'

        if not os.path.exists(file_path):
            os.makedirs(file_path)

        full_filename = f'{file_path}/{filename}'

        with open(full_filename, 'w') as outcsv:
            writer = csv.DictWriter(outcsv, fieldnames = ['user', 'datetime',
                                                        'message'])
            writer.writeheader()
            writer.writerows({'user': message[0],
                            'datetime': message[1],
                            'message': message[2]}
                            for message in package_messages)
