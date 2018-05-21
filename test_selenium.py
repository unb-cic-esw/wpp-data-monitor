import time
import unittest
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as EC

class TestSelenium(unittest.TestCase):

    def setUp(self):
        fp = webdriver.FirefoxProfile('/home/dayoff/GitHub/wpp-data-monitor/profile')

        # create the fake browser
        self.driver = webdriver.Firefox(fp)
        self.wait = WebDriverWait(self.driver, 10)
        # get request using the fake browser
        self.driver.get('https://web.whatsapp.com/')
        xpath_home = "//*[contains(text(), 'Mantenha seu telefone conectado')]"
        self.wait_for_element(xpath_home)

    def wait_for_element(self, name):
        return self.wait.until(EC.visibility_of_element_located((By.XPATH,
                                                                    name)))

    def test_click_on_group(self):
        group_name = 'GRUPO DAS PESSOAS LEGAIS'
        xpath_group = '//*[@title="{}"]'.format(group_name)

        self.wait_for_element(xpath_group)

        group = self.driver.find_element_by_xpath(xpath_group)
        group.click()

        groups = self.driver.find_elements_by_xpath(xpath_group)

        self.assertEqual(2, len(groups))

    def test_click_on_group_and_send_text(self):
        group_name = 'GRUPO DAS PESSOAS LEGAIS'
        xpath_group = '//*[@title="{}"]'.format(group_name)

        self.wait_for_element(xpath_group)

        group = self.driver.find_element_by_xpath(xpath_group)
        group.click()

        groups = self.driver.find_elements_by_xpath(xpath_group)

        self.assertEqual(2, len(groups))

        xpath_input_group = "//div[@contenteditable='true']"
        input_group = self.driver.find_element_by_xpath(xpath_input_group)
        text = 'olar teozinnnn'
        input_group.send_keys(text)
        self.driver.find_element_by_tag_name("body").send_keys(Keys.RETURN)

        time.sleep(2)
        html = self.driver.page_source
        soup = BeautifulSoup(html, "html.parser")
        time.sleep(1)
        texts = soup.findAll("span",
                    {"class": "selectable-text invisible-space copyable-text"})

        self.assertEqual(text, texts[-1].text)

    def tearDown(self):
        # wait a little and close the fake web
        time.sleep(2)
        self.driver.quit()

if __name__ == '__main__':
    unittest.main()
