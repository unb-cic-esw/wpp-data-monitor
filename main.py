import time
import os
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as EC

fp = webdriver.FirefoxProfile(os.getcwd() + "/profile")
# create the fake browser
driver = webdriver.Firefox(fp)

def wait_for_element(name):
    wait = WebDriverWait(driver, 10)
    return wait.until(EC.visibility_of_element_located((By.XPATH, name)))

def main():
    # get request using the fake browser
    driver.get('https://web.whatsapp.com/')
    xpath_home = "//*[contains(text(), 'Mantenha seu telefone conectado')]"
    wait_for_element(xpath_home)

    group_name = 'GRUPO DAORA'
    xpath_group = '//*[@title="{}"]'.format(group_name)

    wait_for_element(xpath_group)

    group = driver.find_element_by_xpath(xpath_group)
    group.click()

    groups = driver.find_elements_by_xpath(xpath_group)

    xpath_input_group = "//div[@contenteditable='true']"
    input_group = driver.find_element_by_xpath(xpath_input_group)
    text = 'olaarrrr, quer tc?'
    input_group.send_keys(text)
    driver.find_element_by_tag_name("body").send_keys(Keys.RETURN)

    html = driver.page_source
    soup = BeautifulSoup(html, "html.parser")
    texts = soup.findAll("span",
                {"class": "selectable-text invisible-space copyable-text"})
    time.sleep(2)

    while True:
        html = driver.page_source
        soup = BeautifulSoup(html, "html.parser")
        time.sleep(2)
        current_text = soup.findAll("span",
                    {"class": "selectable-text invisible-space copyable-text"})

        messages_to_send = len(current_text) - len(texts)
        if messages_to_send != 0:
            texts = list(current_text)
            for message in current_text[-messages_to_send:]:
                texts.append(message)
                input_group.send_keys(message.text)
                driver.find_element_by_tag_name("body").send_keys(Keys.RETURN)


if __name__ == '__main__':
    main()
