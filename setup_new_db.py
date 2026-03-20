import mysql.connector

try:
    # Connect to MySQL server
    conn = mysql.connector.connect(host='localhost', user='root', password='')
    cursor = conn.cursor()
    
    # Create the new database
    cursor.execute("CREATE DATABASE IF NOT EXISTS ai_books_db")
    cursor.execute("USE ai_books_db")
    
    # Create the uploaded_books table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS uploaded_books (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            upload_time DATETIME NOT NULL,
            pages VARCHAR(50) DEFAULT '-'
        )
    ''')
    
    conn.commit()
    conn.close()
    print("New 'ai_books_db' database and 'uploaded_books' table successfully created!")
except Exception as e:
    print(f"MySQL Error: {e}")
