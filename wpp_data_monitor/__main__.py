'''
This is the main entry point for running whatsapp data monitor.
'''
from wpp_data_monitor import main


def start():
    # starts whatsapp data monitor engine
    main.run()


if __name__ == "__main__":
    start()
