import os
from kombu import Connection, Exchange, Queue

broker_dir = os.path.abspath("backend/broker_queue")
queue_dir = os.path.join(broker_dir, "queue")
os.makedirs(queue_dir, exist_ok=True)

conn = Connection("filesystem://", transport_options={
    'data_folder_in': queue_dir,
    'data_folder_out': queue_dir,
})

try:
    conn.connect()
    print("SUCCESS: Connected to filesystem broker")
    
    queue = Queue('test_queue', Exchange('test_exchange'), routing_key='test_queue')
    producer = conn.Producer(serializer='json')
    producer.publish({'hello': 'world'}, exchange=queue.exchange, routing_key=queue.routing_key, declare=[queue])
    print("SUCCESS: Published message")
    
    # Check for file
    files = os.listdir(queue_dir)
    print(f"FILES IN QUEUE DIR: {files}")
    
except Exception as e:
    print(f"FAILED: {str(e)}")
finally:
    conn.release()
