#!/usr/bin/env python3
"""
WikiGPT Database Manager
Advanced database management and optimization tools
"""

import sqlite3
import os
import json
import time
from datetime import datetime
import shutil
from collections import defaultdict, Counter

class DatabaseManager:
    def __init__(self):
        self.db_path = "data/wikipedia.db"
        self.backup_dir = "data/backups"
        
        # Ensure directories exist
        os.makedirs("data", exist_ok=True)
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def get_database_info(self):
        """Get comprehensive database information"""
        if not os.path.exists(self.db_path):
            return {"error": "Database not found"}
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Basic statistics
            cursor.execute("SELECT COUNT(*) FROM articles")
            total_articles = cursor.fetchone()[0]
            
            cursor.execute("SELECT AVG(word_count), MIN(word_count), MAX(word_count) FROM articles")
            avg_words, min_words, max_words = cursor.fetchone()
            
            cursor.execute("SELECT SUM(word_count) FROM articles")
            total_words = cursor.fetchone()[0] or 0
            
            # Database size
            db_size = os.path.getsize(self.db_path)
            
            # Category analysis
            cursor.execute("""
                SELECT category, COUNT(*) as count, AVG(word_count) as avg_words
                FROM articles 
                WHERE category IS NOT NULL AND category != ''
                GROUP BY category 
                ORDER BY count DESC 
                LIMIT 20
            """)
            top_categories = cursor.fetchall()
            
            # Quality metrics
            cursor.execute("SELECT AVG(importance_score), MIN(importance_score), MAX(importance_score) FROM articles")
            avg_importance, min_importance, max_importance = cursor.fetchone()
            
            # Recent articles
            cursor.execute("""
                SELECT title, word_count, importance_score, last_updated
                FROM articles 
                ORDER BY last_updated DESC 
                LIMIT 10
            """)
            recent_articles = cursor.fetchall()
            
            # Search index statistics
            cursor.execute("SELECT COUNT(*) FROM search_index")
            total_keywords = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(DISTINCT keyword) FROM search_index")
            unique_keywords = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                "total_articles": total_articles,
                "total_words": total_words,
                "avg_words": int(avg_words) if avg_words else 0,
                "min_words": min_words or 0,
                "max_words": max_words or 0,
                "database_size_mb": db_size / (1024 * 1024),
                "top_categories": top_categories,
                "avg_importance": avg_importance or 0,
                "min_importance": min_importance or 0,
                "max_importance": max_importance or 0,
                "recent_articles": recent_articles,
                "total_keywords": total_keywords,
                "unique_keywords": unique_keywords
            }
            
        except Exception as e:
            conn.close()
            return {"error": str(e)}
    
    def optimize_database(self):
        """Optimize database performance"""
        if not os.path.exists(self.db_path):
            print("❌ Database not found")
            return False
        
        print("🔧 Optimizing database...")
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Analyze tables
            print("📊 Analyzing tables...")
            cursor.execute("ANALYZE")
            
            # Vacuum to reclaim space
            print("🧹 Vacuuming database...")
            cursor.execute("VACUUM")
            
            # Reindex
            print("📇 Rebuilding indexes...")
            cursor.execute("REINDEX")
            
            conn.close()
            print("✅ Database optimization completed!")
            return True
            
        except Exception as e:
            print(f"❌ Optimization failed: {e}")
            return False
    
    def backup_database(self):
        """Create database backup"""
        if not os.path.exists(self.db_path):
            print("❌ Database not found")
            return False
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(self.backup_dir, f"wikipedia_backup_{timestamp}.db")
        
        try:
            print(f"💾 Creating backup: {backup_path}")
            shutil.copy2(self.db_path, backup_path)
            
            # Also backup status files
            status_files = [
                "data/download_status.json",
                "data/ai_stats.json",
                "data/extractor_progress.json"
            ]
            
            for file_path in status_files:
                if os.path.exists(file_path):
                    filename = os.path.basename(file_path)
                    backup_file = os.path.join(self.backup_dir, f"{filename}_{timestamp}")
                    shutil.copy2(file_path, backup_file)
            
            print("✅ Backup completed successfully!")
            return backup_path
            
        except Exception as e:
            print(f"❌ Backup failed: {e}")
            return False
    
    def restore_database(self, backup_path):
        """Restore database from backup"""
        if not os.path.exists(backup_path):
            print("❌ Backup file not found")
            return False
        
        try:
            print(f"🔄 Restoring from: {backup_path}")
            
            # Create backup of current database
            if os.path.exists(self.db_path):
                current_backup = f"{self.db_path}.pre_restore"
                shutil.copy2(self.db_path, current_backup)
                print(f"📋 Current database backed up to: {current_backup}")
            
            # Restore
            shutil.copy2(backup_path, self.db_path)
            print("✅ Database restored successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Restore failed: {e}")
            return False
    
    def clean_database(self):
        """Clean and optimize database content"""
        if not os.path.exists(self.db_path):
            print("❌ Database not found")
            return False
        
        print("🧹 Cleaning database...")
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Remove articles with very little content
            print("🗑️  Removing articles with less than 100 words...")
            cursor.execute("DELETE FROM articles WHERE word_count < 100")
            removed_short = cursor.rowcount
            
            # Remove duplicate articles (same title)
            print("🔍 Removing duplicate articles...")
            cursor.execute("""
                DELETE FROM articles 
                WHERE id NOT IN (
                    SELECT MIN(id) 
                    FROM articles 
                    GROUP BY title
                )
            """)
            removed_duplicates = cursor.rowcount
            
            # Clean up search index for removed articles
            print("🗂️  Cleaning search index...")
            cursor.execute("""
                DELETE FROM search_index 
                WHERE article_id NOT IN (SELECT id FROM articles)
            """)
            removed_index_entries = cursor.rowcount
            
            # Update statistics
            cursor.execute("UPDATE articles SET last_updated = ? WHERE last_updated IS NULL", 
                          (datetime.now(),))
            
            conn.commit()
            conn.close()
            
            print(f"✅ Cleaning completed!")
            print(f"   📝 Removed {removed_short} short articles")
            print(f"   🔄 Removed {removed_duplicates} duplicate articles")
            print(f"   🗂️  Cleaned {removed_index_entries} index entries")
            
            return True
            
        except Exception as e:
            print(f"❌ Cleaning failed: {e}")
            return False
    
    def export_statistics(self):
        """Export detailed statistics to JSON"""
        info = self.get_database_info()
        
        if "error" in info:
            print(f"❌ Cannot export statistics: {info['error']}")
            return False
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_file = f"data/database_stats_{timestamp}.json"
        
        try:
            with open(export_file, 'w') as f:
                json.dump(info, f, indent=2, default=str)
            
            print(f"📊 Statistics exported to: {export_file}")
            return export_file
            
        except Exception as e:
            print(f"❌ Export failed: {e}")
            return False
    
    def search_articles(self, query, limit=10):
        """Search articles in database"""
        if not os.path.exists(self.db_path):
            print("❌ Database not found")
            return []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Search by title and content
            cursor.execute("""
                SELECT title, word_count, importance_score, 
                       substr(content, 1, 200) as preview
                FROM articles 
                WHERE title LIKE ? OR content LIKE ?
                ORDER BY importance_score DESC, word_count DESC
                LIMIT ?
            """, (f'%{query}%', f'%{query}%', limit))
            
            results = cursor.fetchall()
            conn.close()
            
            return results
            
        except Exception as e:
            print(f"❌ Search failed: {e}")
            conn.close()
            return []
    
    def display_menu(self):
        """Display management menu"""
        os.system('cls' if os.name == 'nt' else 'clear')
        
        print("🛠️" * 25)
        print("   WIKIGPT DATABASE MANAGER")
        print("🛠️" * 25)
        print()
        
        # Show database info
        info = self.get_database_info()
        if "error" not in info:
            print("📊 DATABASE OVERVIEW")
            print("-" * 40)
            print(f"📚 Articles: {info['total_articles']:,}")
            print(f"📝 Total Words: {info['total_words']:,}")
            print(f"💾 Size: {info['database_size_mb']:.2f} MB")
            print(f"📊 Avg Article Length: {info['avg_words']} words")
            print(f"🌟 Avg Importance: {info['avg_importance']:.2f}")
            print()
        
        print("🎮 MANAGEMENT OPTIONS")
        print("-" * 40)
        print("1. 📊 Show Detailed Statistics")
        print("2. 🔍 Search Articles")
        print("3. 🔧 Optimize Database")
        print("4. 🧹 Clean Database")
        print("5. 💾 Create Backup")
        print("6. 🔄 Restore from Backup")
        print("7. 📈 Export Statistics")
        print("8. 📋 List Backups")
        print("9. 🚪 Exit")
        print("-" * 40)
    
    def show_detailed_stats(self):
        """Show comprehensive database statistics"""
        info = self.get_database_info()
        
        if "error" in info:
            print(f"❌ Error: {info['error']}")
            return
        
        os.system('cls' if os.name == 'nt' else 'clear')
        print("📊 DETAILED DATABASE STATISTICS")
        print("=" * 60)
        
        # Basic stats
        print("\n📈 BASIC STATISTICS")
        print("-" * 30)
        print(f"Total Articles:      {info['total_articles']:,}")
        print(f"Total Words:         {info['total_words']:,}")
        print(f"Database Size:       {info['database_size_mb']:.2f} MB")
        print(f"Average Words:       {info['avg_words']:,}")
        print(f"Shortest Article:    {info['min_words']:,} words")
        print(f"Longest Article:     {info['max_words']:,} words")
        
        # Quality metrics
        print(f"\n🌟 QUALITY METRICS")
        print("-" * 30)
        print(f"Average Importance:  {info['avg_importance']:.3f}")
        print(f"Min Importance:      {info['min_importance']:.3f}")
        print(f"Max Importance:      {info['max_importance']:.3f}")
        
        # Search index
        print(f"\n🔍 SEARCH INDEX")
        print("-" * 30)
        print(f"Total Keywords:      {info['total_keywords']:,}")
        print(f"Unique Keywords:     {info['unique_keywords']:,}")
        print(f"Keywords per Article: {info['total_keywords']/max(info['total_articles'],1):.1f}")
        
        # Top categories
        if info['top_categories']:
            print(f"\n🏷️  TOP CATEGORIES")
            print("-" * 30)
            for category, count, avg_words in info['top_categories'][:10]:
                if category and category.strip():
                    print(f"{category[:25]:<25} {count:>6} articles ({avg_words:.0f} avg words)")
        
        # Recent articles
        if info['recent_articles']:
            print(f"\n🆕 RECENT ARTICLES")
            print("-" * 30)
            for title, word_count, importance, last_updated in info['recent_articles'][:5]:
                print(f"{title[:40]:<40} {word_count:>6} words (⭐{importance:.2f})")
        
        input("\nPress Enter to continue...")
    
    def list_backups(self):
        """List available backups"""
        if not os.path.exists(self.backup_dir):
            print("❌ No backup directory found")
            return
        
        backups = [f for f in os.listdir(self.backup_dir) if f.endswith('.db')]
        
        if not backups:
            print("📂 No backups found")
            return
        
        print("💾 AVAILABLE BACKUPS")
        print("-" * 50)
        
        for i, backup in enumerate(sorted(backups, reverse=True), 1):
            backup_path = os.path.join(self.backup_dir, backup)
            size_mb = os.path.getsize(backup_path) / (1024 * 1024)
            
            # Extract timestamp from filename
            timestamp = backup.replace('wikipedia_backup_', '').replace('.db', '')
            try:
                dt = datetime.strptime(timestamp, '%Y%m%d_%H%M%S')
                date_str = dt.strftime('%Y-%m-%d %H:%M:%S')
            except:
                date_str = timestamp
            
            print(f"{i:2d}. {backup:<35} {size_mb:>8.2f} MB  {date_str}")
        
        print("-" * 50)
    
    def run(self):
        """Main management loop"""
        while True:
            try:
                self.display_menu()
                choice = input("\n🎯 Select option (1-9): ").strip()
                
                if choice == '1':
                    self.show_detailed_stats()
                
                elif choice == '2':
                    query = input("🔍 Enter search query: ").strip()
                    if query:
                        print(f"\n🔍 Searching for: '{query}'")
                        results = self.search_articles(query)
                        
                        if results:
                            print(f"\n📋 Found {len(results)} results:")
                            print("-" * 80)
                            for title, words, importance, preview in results:
                                print(f"📄 {title}")
                                print(f"   {words} words, ⭐{importance:.2f}")
                                print(f"   {preview}...")
                                print()
                        else:
                            print("❌ No results found")
                        
                        input("Press Enter to continue...")
                
                elif choice == '3':
                    self.optimize_database()
                    input("Press Enter to continue...")
                
                elif choice == '4':
                    confirm = input("⚠️  Clean database? This will remove short articles and duplicates (y/n): ")
                    if confirm.lower() == 'y':
                        self.clean_database()
                    input("Press Enter to continue...")
                
                elif choice == '5':
                    self.backup_database()
                    input("Press Enter to continue...")
                
                elif choice == '6':
                    self.list_backups()
                    backup_name = input("\n📂 Enter backup filename (or press Enter to cancel): ").strip()
                    if backup_name:
                        backup_path = os.path.join(self.backup_dir, backup_name)
                        self.restore_database(backup_path)
                    input("Press Enter to continue...")
                
                elif choice == '7':
                    export_file = self.export_statistics()
                    if export_file:
                        print(f"✅ Statistics exported successfully!")
                    input("Press Enter to continue...")
                
                elif choice == '8':
                    self.list_backups()
                    input("Press Enter to continue...")
                
                elif choice == '9':
                    print("\n👋 Database manager closed!")
                    break
                
                else:
                    print("❌ Invalid option")
                    time.sleep(1)
                    
            except KeyboardInterrupt:
                print("\n\n👋 Goodbye!")
                break
            except Exception as e:
                print(f"\n❌ Error: {e}")
                input("Press Enter to continue...")

def main():
    """Main function"""
    manager = DatabaseManager()
    manager.run()

if __name__ == "__main__":
    main()
