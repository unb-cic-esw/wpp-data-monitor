from wpp_data_monitor.collect_message import EngineWpp

def run():
    engine = EngineWpp()
    engine.click_group('GRUPO RESOCIE')
    package_messages = engine.get_message_from_group()
    # engine.record_messages(texts)
    print(package_messages)

    # while True:
    #     html = driver.page_source
    #     soup = BeautifulSoup(html, "html.parser")
    #     time.sleep(2)
    #     current_text = soup.findAll("span",
    #                 {"class": "selectable-text invisible-space copyable-text"})
    #
    #     messages_to_send = len(current_text) - len(texts)
    #     if messages_to_send != 0:
    #         texts = list(current_text)
    #         for message in current_text[-messages_to_send:]:
    #             texts.append(message)
    #             input_group.send_keys(message.text)
    #             driver.find_element_by_tag_name("body").send_keys(Keys.RETURN)


if __name__ == '__main__':
    main()
