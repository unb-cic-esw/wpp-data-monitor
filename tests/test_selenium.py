from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By

from selenium import webdriver
from bs4 import BeautifulSoup
import unittest
import time
import os


class TestSelenium(unittest.TestCase):

    def setUp(self):
        # default group to test
        self.default_group = 'GRUPO RESOCIE'

        # chromedriver binary
        driver_path = os.getcwd() + '/chromedriver'
        profile_path = os.getcwd() + '/profile/'

        chrome_options = webdriver.ChromeOptions()
        # chrome_options.add_argument('--headless')
        chrome_options.add_argument(f'--user-data-dir={profile_path}')

        # create the fake browser
        self.driver = webdriver.Chrome(driver_path, options=chrome_options)

        self.wait = WebDriverWait(self.driver, 10)
        # get request using the fake browser
        self.driver.get('https://web.whatsapp.com/')
        xpath_home = "//*[contains(text(), 'Mantenha seu telefone conectado')]"
        self.wait_for_element(xpath_home)


    def wait_for_element(self, name):
        return self.wait.until(EC.visibility_of_element_located((By.XPATH,
                                                                    name)))

    def test_click_on_default_group(self):
        xpath_group = f'//*[@title="{self.default_group}"]'
        self.wait_for_element(xpath_group)

        group = self.driver.find_element_by_xpath(xpath_group)
        group.click()

        groups = self.driver.find_elements_by_xpath(xpath_group)

        # after click on the group, if there are two title of this group on
        # the screen it means that there are information about them on the
        # sidebar and as the title in the header of the group clicked
        self.assertEqual(2, len(groups))

    def test_click_on_group_and_send_text(self):
        xpath_group = f'//*[@title="{self.default_group}"]'
        self.wait_for_element(xpath_group)

        group = self.driver.find_element_by_xpath(xpath_group)
        group.click()

        groups = self.driver.find_elements_by_xpath(xpath_group)

        # after click on the group, if there are two title of this group on
        # the screen it means that there are information about them on the
        # sidebar and as the title in the header of the group clicked
        self.assertEqual(2, len(groups))

        # finds the form input
        xpath_input_group = "//div[@contenteditable='true']"
        input_group = self.driver.find_element_by_xpath(xpath_input_group)
        text = 'Olá, resocie!'
        input_group.send_keys(text)
        xpath_send_group = "//span[@data-icon='send']"
        send_group = self.driver.find_element_by_xpath(xpath_send_group)
        send_group.click()

        time.sleep(2)
        html = self.driver.page_source
        soup = BeautifulSoup(html, "html.parser")
        time.sleep(1)
        texts = soup.findAll("span",
                    {"class": "selectable-text invisible-space copyable-text"})

        # checks if the last message received in the group was the message sent
        self.assertEqual(text, texts[-1].text)

    def tearDown(self):
        # wait a little and close the fake web
        time.sleep(2)
        self.driver.quit()


if __name__ == '__main__':
    unittest.main()
